const cryptoHelper = {
    async generateKeyPair() {
        try {
            const keyPair = await window.crypto.subtle.generateKey(
                { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
                true,
                ["encrypt", "decrypt"]
            );
            return {
                publicKey: btoa(String.fromCharCode(...new Uint8Array(await window.crypto.subtle.exportKey("spki", keyPair.publicKey)))), // Convert to Base64
                privateKey: btoa(String.fromCharCode(...new Uint8Array(await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey)))) // Convert to Base64
            };
        } catch (error) {
            console.error('Error generating key pair:', error.message);
            throw error;
        }
    },
    async encryptMessage(message, publicKey) {
        try {
            const publicKeyBuffer = Uint8Array.from(atob(publicKey), (c) => c.charCodeAt(0)); // Convert Base64 to ArrayBuffer
            const importedPublicKey = await window.crypto.subtle.importKey(
                "spki",
                publicKeyBuffer.buffer,
                { name: "RSA-OAEP", hash: "SHA-256" },
                true,
                ["encrypt"]
            );
            const encoder = new TextEncoder();
            const encodedMessage = encoder.encode(message);
            const encrypted = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, importedPublicKey, encodedMessage);
            return btoa(String.fromCharCode(...new Uint8Array(encrypted))); // Convert to Base64
        } catch (error) {
            console.error('Error encrypting message:', error.message);
            throw error;
        }
    },
    async decryptMessage(encryptedMessage, privateKey) {
        try {
            const privateKeyBuffer = Uint8Array.from(atob(privateKey), (c) => c.charCodeAt(0)); // Convert Base64 to ArrayBuffer
            const importedPrivateKey = await window.crypto.subtle.importKey(
                "pkcs8",
                privateKeyBuffer.buffer,
                { name: "RSA-OAEP", hash: "SHA-256" },
                true,
                ["decrypt"]
            );
            const encryptedBuffer = Uint8Array.from(atob(encryptedMessage), (c) => c.charCodeAt(0)); // Convert Base64 to ArrayBuffer
            const decrypted = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, importedPrivateKey, encryptedBuffer);
            return new TextDecoder().decode(decrypted);
        } catch (error) {
            console.error('Error decrypting message:', error.message);
            throw error;
        }
    }
};
