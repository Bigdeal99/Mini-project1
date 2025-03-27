const cryptoHelper = {
    generateKeyPair() {
        const { publicKey, privateKey } = window.crypto.subtle.generateKey(
            { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
            true,
            ["encrypt", "decrypt"]
        );
        return { publicKey, privateKey };
    },
    encryptMessage(message, publicKey) {
        const encoder = new TextEncoder();
        const encodedMessage = encoder.encode(message);
        return window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, encodedMessage);
    },
    decryptMessage(encryptedMessage, privateKey) {
        return window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, encryptedMessage)
            .then((decrypted) => new TextDecoder().decode(decrypted));
    }
};
