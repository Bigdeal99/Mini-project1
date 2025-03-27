export default class CryptoHelper {
  constructor() {
      this.keyPair = null;
      this.ephemeralKeys = new Map();
  }
  async importPublicKey(base64Key) {
    try {
        const binaryKey = this.base64ToArrayBuffer(base64Key);
        return await window.crypto.subtle.importKey(
            "spki",
            binaryKey,
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["encrypt"]
        );
    } catch (error) {
        console.error('Key import failed:', error);
        throw new Error('Invalid public key format');
    }
}

async fetchPublicKey(username) {
    try {
        const response = await fetch(`http://localhost:3000/public-key/${username}`);
        const data = await response.json();
        return this.importPublicKey(data.publicKey);
    } catch (error) {
        console.error('Failed to fetch public key:', error);
        throw new Error('Could not retrieve public key for user');
    }
}
  // Key Generation
  async generateRSAKeys() {
      this.keyPair = await window.crypto.subtle.generateKey({
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
          hash: "SHA-256",
      }, true, ["encrypt", "decrypt", "wrapKey", "unwrapKey"]);
  }

  async generateEphemeralAESKey() {
      return window.crypto.subtle.generateKey({
          name: "AES-GCM",
          length: 256
      }, false, ["encrypt", "decrypt"]);
  }

  // Key Exchange with Forward Secrecy
  async performKeyExchange(publicKey) {
      const sessionKey = await this.generateEphemeralAESKey();
      const wrappedKey = await window.crypto.subtle.wrapKey(
          "raw",
          sessionKey,
          publicKey,
          { name: "RSA-OAEP" }
      );
      
      return {
          key: this.arrayBufferToBase64(wrappedKey),
          expires: Date.now() + 3600000 // 1 hour expiration
      };
  }

  async receiveKeyExchange(wrappedKey) {
      const key = await window.crypto.subtle.unwrapKey(
          "raw",
          this.base64ToArrayBuffer(wrappedKey),
          this.keyPair.privateKey,
          { name: "RSA-OAEP" },
          { name: "AES-GCM" },
          false,
          ["encrypt", "decrypt"]
      );
      
      return {
          key,
          expires: Date.now() + 3600000
      };
  }

  // Message Handling with Signatures
  async encryptMessage(message, key) {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(message);
      
      const ciphertext = await window.crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          encoded
      );

      const signature = await this.signMessage(iv, ciphertext);

      return {
          iv: this.arrayBufferToBase64(iv),
          data: this.arrayBufferToBase64(ciphertext),
          signature
      };
  }

  async decryptMessage(data, iv, key, signature, publicKey) {
      const ciphertext = this.base64ToArrayBuffer(data);
      const initializationVector = this.base64ToArrayBuffer(iv);

      await this.verifySignature(
          this.base64ToArrayBuffer(signature),
          initializationVector,
          ciphertext,
          publicKey
      );

      return window.crypto.subtle.decrypt(
          { name: "AES-GCM", iv: initializationVector },
          key,
          ciphertext
      ).then(decrypted => new TextDecoder().decode(decrypted));
  }

  // Signatures
  async signMessage(...buffers) {
      const data = this.concatBuffers(...buffers);
      const signature = await window.crypto.subtle.sign(
          { name: "RSA-PSS", saltLength: 32 },
          this.keyPair.privateKey,
          data
      );
      return this.arrayBufferToBase64(signature);
  }

  async verifySignature(signature, ...buffers) {
      const data = this.concatBuffers(...buffers);
      const publicKey = await this.importPublicKey(/* pass sender's public key */);
      return window.crypto.subtle.verify(
          { name: "RSA-PSS", saltLength: 32 },
          publicKey,
          signature,
          data
      );
  }

  // Utilities
  arrayBufferToBase64(buffer) {
      return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  base64ToArrayBuffer(base64) {
      return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  concatBuffers(...buffers) {
      const totalLength = buffers.reduce((acc, buf) => acc + buf.byteLength, 0);
      const temp = new Uint8Array(totalLength);
      let offset = 0;
      
      buffers.forEach(buf => {
          temp.set(new Uint8Array(buf), offset);
          offset += buf.byteLength;
      });
      
      return temp.buffer;
  }
}