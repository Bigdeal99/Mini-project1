export default class CryptoHelper {
    constructor() {
      this.keyPair = null;
    }
  
    async generateRSAKeys() {
      this.keyPair = await window.crypto.subtle.generateKey({
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: "SHA-256",
      }, true, ["encrypt", "decrypt"]);
    }
  
    async exportPublicKey() {
      const exported = await window.crypto.subtle.exportKey(
        "spki",
        this.keyPair.publicKey
      );
      return this.arrayBufferToBase64(exported);
    }
  
    async importPublicKey(base64Key) {
      const binaryKey = this.base64ToArrayBuffer(base64Key);
      return window.crypto.subtle.importKey(
        "spki",
        binaryKey,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
      );
    }
  
    async generateAESKey() {
      return window.crypto.subtle.generateKey({
        name: "AES-GCM",
        length: 256
      }, true, ["encrypt", "decrypt"]);
    }
  
    async encryptMessage(message, key) {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(message);
      
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoded
      );
  
      return {
        iv: this.arrayBufferToBase64(iv),
        data: this.arrayBufferToBase64(ciphertext)
      };
    }
  
    async decryptMessage(data, iv, key) {
      const ciphertext = this.base64ToArrayBuffer(data);
      const initializationVector = this.base64ToArrayBuffer(iv);
  
      return window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: initializationVector },
        key,
        ciphertext
      ).then(decrypted => new TextDecoder().decode(decrypted));
    }
  
    // Utilities
    arrayBufferToBase64(buffer) {
      return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }
  
    base64ToArrayBuffer(base64) {
      return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    }
  }