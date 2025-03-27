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
            };
            
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
socket.onAny((event, ...args) => {
    console.log('Received event:', event, args);
});

socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
});
socket.on('private-message', async (message) => {
    try {
        const privateKey = localStorage.getItem('privateKey');
        if (!privateKey) {
            console.error('No private key found');
            return;
        }

        // Convert base64 private key to ArrayBuffer
        const decrypted = await cryptoHelper.decryptMessage(message.data, privateKey);
        
        // Create message element
        const chat = document.getElementById('chat');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.innerHTML = `
            <strong>${message.sender}:</strong>
            <span>${decrypted}</span>
            <div class="time">${new Date(message.timestamp).toLocaleTimeString()}</div>
        `;
        
        chat.appendChild(messageDiv);
        chat.scrollTop = chat.scrollHeight; // Auto-scroll to bottom
    } catch (error) {
        console.error('Decryption error:', error);
        // Show error to user
        const statusDiv = document.getElementById('message-status');
        statusDiv.textContent = `Error decrypting message: ${error.message}`;
        statusDiv.style.color = 'red';
    }
});