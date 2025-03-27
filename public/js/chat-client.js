export default class ChatClient {
    constructor() {
        this.socket = io('http://localhost:3000', {
            autoConnect: false,
            reconnectionAttempts: 3
        });
        this.crypto = new CryptoHelper();
        this.sessionKeys = new Map();
        this.username = null;
        this.publicKey = null;
        this.connected = false;

        this.initializeSocketListeners();
    }

    async register(username) {
        try {
            console.log('Register function called'); // Debugging log
            if (!username || username.trim() === '') {
                throw new Error('Username cannot be empty');
            }

            console.log('Generating RSA keys...');
            await this.crypto.generateRSAKeys();
            this.username = username.trim();
            this.publicKey = await this.crypto.exportPublicKey();

            console.log('Attempting to register with username:', this.username);
            this.socket.auth = { 
                username: this.username,
                publicKey: this.publicKey
            };

            console.log('Connecting to the server...');
            this.socket.connect();

            // Disable UI elements
            document.getElementById('username').disabled = true;
            document.getElementById('registerBtn').disabled = true;
            document.getElementById('status').textContent = 'Connecting...';

        } catch (error) {
            console.error('Registration failed:', error);
            alert(`Registration failed: ${error.message}`);
            this.resetRegistrationUI();
        }
    }

    initializeSocketListeners() {
        this.socket.on('connect', () => {
            this.connected = true;
            console.log('Socket connected with ID:', this.socket.id);
            document.getElementById('status').textContent = `Connected as ${this.username}`;
        });

        this.socket.on('connect_error', (err) => {
            console.error('Connection error:', err.message);
            this.resetRegistrationUI();
            alert(`Connection failed: ${err.message}`);
        });

        this.socket.on('user_list', users => {
            console.log('Received user list:', users);
            this.handleUserList(users);
        });

        this.socket.on('message', msg => {
            console.log('Received message:', msg);
            this.handleIncomingMessage(msg);
        });
    }

    resetRegistrationUI() {
        this.connected = false;
        document.getElementById('username').disabled = false;
        document.getElementById('registerBtn').disabled = false;
        document.getElementById('status').textContent = 'Not connected';
    }

    handleUserList(users) {
        const event = new CustomEvent('userlist_update', { detail: users });
        document.dispatchEvent(event);
    }

    async handleIncomingMessage(msg) {
        try {
            if (msg.type === 'key_exchange') {
                const sessionKey = await this.crypto.decryptSessionKey(msg.data);
                this.sessionKeys.set(msg.sender, {
                    key: sessionKey,
                    expires: Date.now() + 3600000
                });
                return;
            }

            const session = this.sessionKeys.get(msg.sender);
            if (!session) throw new Error('No session key found');

            const decrypted = await this.crypto.decryptMessage(
                msg.data,
                msg.iv,
                session.key
            );

            this.displayMessage(decrypted, false);
        } catch (error) {
            console.error('Message processing failed:', error);
        }
    }

    async establishSession(recipient) {
        return new Promise(async (resolve, reject) => {
            try {
                const publicKey = await this.fetchPublicKey(recipient);
                const sessionKey = await this.crypto.generateEphemeralAESKey();
                const wrappedKey = await this.crypto.wrapSessionKey(sessionKey, publicKey);

                this.sessionKeys.set(recipient, {
                    key: sessionKey,
                    expires: Date.now() + 3600000
                });

                this.socket.emit('message', {
                    type: 'key_exchange',
                    sender: this.username,
                    recipient,
                    data: wrappedKey
                });

                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    // UI Methods
    displayMessage(message, isSelf) {
        const messagesDiv = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSelf ? 'self' : ''}`;

        messageDiv.innerHTML = `
            <div class="message-bubble">
                <div class="message-text">${message}</div>
                <div class="message-info">
                    <span class="status">${isSelf ? '✓' : ''}</span>
                    <span class="time">${new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        `;

        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    updateStatus(text) {
        document.getElementById('status').textContent = text;
    }

    showError(text) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = text;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }
}