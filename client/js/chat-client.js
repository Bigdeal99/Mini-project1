const chatClient = {
    async register() {
        try {
            const username = document.getElementById('username').value;
            if (!username) {
                throw new Error('Username is required');
            }

            const keyPair = await cryptoHelper.generateKeyPair();
            localStorage.setItem('privateKey', keyPair.privateKey);

            socket.auth = { 
                username, 
                publicKey: keyPair.publicKey 
            }; // Ensure this is set before connecting

            socket.connect();
            document.getElementById('registration-status').innerText = `Registered as ${username}`;
        } catch (error) {
            document.getElementById('registration-status').innerText = `Registration failed: ${error.message}`;
        }
    },

    async sendMessage() {
        try {
            const recipient = document.getElementById('recipient').value;
            const message = document.getElementById('message').value;
            
            if (!recipient || !message) {
                throw new Error('Recipient and message are required');
            }

            const recipientPublicKey = await this.getRecipientPublicKey(recipient);
            if (!recipientPublicKey) {
                throw new Error('Recipient not found');
            }

            const encryptedMessage = await cryptoHelper.encryptMessage(message, recipientPublicKey);
            
            socket.emit('private-message', {
                sender: socket.auth.username,
                recipient,
                data: encryptedMessage,
                timestamp: new Date().toISOString()
            });

            this.displayMessage('You', message, true);
            document.getElementById('message').value = '';
        } catch (error) {
            document.getElementById('message-status').innerText = `Error: ${error.message}`;
        }
    },

    async getRecipientPublicKey(recipient) {
        return new Promise((resolve) => {
            socket.emit('get-public-key', recipient, (response) => {
                if (response.error) {
                    console.error('Error getting public key:', response.error);
                    resolve(null);
                } else {
                    resolve(response.publicKey);
                }
            });
        });
    },

    displayMessage(sender, message, isOutgoing = false) {
        const chat = document.getElementById('chat');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
        messageElement.innerHTML = `
            <div class="message-header">${sender}</div>
            <div class="message-body">${message}</div>
        `;
        chat.appendChild(messageElement);
        chat.scrollTop = chat.scrollHeight;
    }
};

// Socket.IO Listeners
socket.on('connect_error', (error) => {
    document.getElementById('registration-status').innerText = `Connection error: ${error.message}`;
});

socket.on('private-message', async (message) => {
    try {
        const privateKey = localStorage.getItem('privateKey');
        if (!privateKey) throw new Error('No decryption key available');

        const decrypted = await cryptoHelper.decryptMessage(message.data, privateKey);
        chatClient.displayMessage(message.sender, decrypted);
    } catch (error) {
        console.error('Decryption error:', error);
    }
});

socket.on('user-status', (status) => {
    document.getElementById('message-status').innerText = status;
});