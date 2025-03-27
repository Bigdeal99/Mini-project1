const cryptoHelper = {
    async generateKeyPair() {
        const keyPair = await window.crypto.subtle.generateKey(
            { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
            true,
            ["encrypt", "decrypt"]
        );
        
        return {
            publicKey: await this.arrayBufferToBase64(
                await window.crypto.subtle.exportKey("spki", keyPair.publicKey)
            ),
            privateKey: await this.arrayBufferToBase64(
                await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey)
            )
        };
    },

    async encryptMessage(message, publicKeyBase64) {
        const publicKey = await window.crypto.subtle.importKey(
            "spki",
            this.base64ToArrayBuffer(publicKeyBase64),
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["encrypt"]
        );

        const encodedMessage = new TextEncoder().encode(message);
        const encrypted = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            publicKey,
            encodedMessage
        );

        return this.arrayBufferToBase64(encrypted);
    },

    async decryptMessage(encryptedBase64, privateKeyBase64) {
        const privateKey = await window.crypto.subtle.importKey(
            "pkcs8",
            this.base64ToArrayBuffer(privateKeyBase64),
            { name: "RSA-OAEP", hash: "SHA-256" },
            true,
            ["decrypt"]
        );

        const decrypted = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            this.base64ToArrayBuffer(encryptedBase64)
        );

        return new TextDecoder().decode(decrypted);
    },

    arrayBufferToBase64(buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    },

    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
};