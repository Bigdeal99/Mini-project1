import CryptoHelper from './crypto-helper.js';

export default class ChatClient {
    constructor() {
        this.socket = io('http://localhost:3000');
        this.crypto = new CryptoHelper();
        this.sessionKeys = new Map();
        this.initializeEventListeners();
    }

    async initializeEventListeners() {
        this.socket.on('connect', () => this.handleConnect());
        this.socket.on('message', (msg) => this.handleMessage(msg));
    }

    async register(username) {
        try {
            await this.crypto.generateRSAKeys();
            this.socket.auth = {
                username,
                publicKey: await this.crypto.exportPublicKey()
            };
            this.socket.connect();
            document.getElementById('status').innerText = 'Registered as ' + username;
        } catch (error) {
            this.showError('Registration failed: ' + error.message);
        }
    }

    async handleConnect() {
        try {
            await this.crypto.generateRSAKeys();
            this.socket.auth = {
                username: document.getElementById('username').value,
                publicKey: await this.crypto.exportPublicKey()
            };
        } catch (error) {
            this.showError('Connection failed: ' + error.message);
        }
    }

    async sendMessage() {
        const recipient = document.getElementById('recipient').value;
        const message = document.getElementById('messageInput').value;

        try {
            if (!this.sessionKeys.has(recipient)) {
                await this.performKeyExchange(recipient);
            }

            const encrypted = await this.crypto.encryptMessage(
                message,
                this.sessionKeys.get(recipient)
            );

            this.socket.emit('message', {
                type: 'message',
                recipient,
                ...encrypted
            });

            this.displayMessage(`You: ${message}`, true);
        } catch (error) {
            this.showError('Send failed: ' + error.message);
        }
    }

    async performKeyExchange(recipient) {
        return new Promise(async (resolve, reject) => {
            try {
                const publicKey = await this.fetchPublicKey(recipient);
                const sessionKey = await this.crypto.generateAESKey();
                const encryptedKey = await this.encryptSessionKey(sessionKey, publicKey);
                
                this.sessionKeys.set(recipient, sessionKey);
                
                this.socket.emit('message', {
                    type: 'key_exchange',
                    recipient,
                    data: encryptedKey
                });

                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    async handleMessage(package) {
        try {
            if (package.type === 'key_exchange') {
                const sessionKey = await this.crypto.decryptSessionKey(package.data);
                this.sessionKeys.set(package.sender, sessionKey);
                this.showStatus(`Secure session with ${package.sender} established`);
            } else {
                const decrypted = await this.crypto.decryptMessage(
                    package.data,
                    package.iv,
                    this.sessionKeys.get(package.sender)
                );
                this.displayMessage(`${package.sender}: ${decrypted}`);
            }
        } catch (error) {
            this.showError(`Decryption failed: ${error.message}`);
        }
    }

    // UI Methods
    displayMessage(message, isSelf = false) {
        const chatDiv = document.getElementById('chat');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSelf ? 'self' : ''}`;
        messageDiv.textContent = message;
        chatDiv.appendChild(messageDiv);
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }

    showStatus(message) {
        document.getElementById('status').textContent = message;
    }

    showError(message) {
        console.error(message);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
    }
}