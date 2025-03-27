import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import logger from './logger.js';

class ChatServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: "http://localhost:3000",
                methods: ["GET", "POST"]
            }
        });
        this.users = new Map();

        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeSocket();
    }

    initializeMiddlewares() {
        this.app.use(express.static('../client'));
        this.app.use(express.json());
    }

    initializeRoutes() {
        this.app.get('/health', (req, res) => {
            res.status(200).json({ status: 'ok', users: this.users.size });
        });
    }

    initializeSocket() {
        this.io.use(this.authenticateConnection.bind(this));
        this.io.on('connection', this.handleConnection.bind(this));
    }

    authenticateConnection(socket, next) {
        const username = socket.handshake.auth.username?.toLowerCase(); // Normalize to lowercase
        if (!username || this.users.has(username)) {
            return next(new Error('Invalid or duplicate username'));
        }
        socket.handshake.auth.username = username; // Store normalized username
        next();
    }

    handleConnection(socket) {
        const username = socket.handshake.auth.username.toLowerCase(); // Normalize to lowercase
        const publicKey = socket.handshake.auth.publicKey;

        this.users.set(username, {
            socketId: socket.id,
            publicKey,
        });

        logger.info(`User connected: ${username} (${socket.id})`);

        socket.on('disconnect', () => {
            this.handleDisconnect(username);
        });

        socket.on('message', (encryptedMessage) => {
            encryptedMessage.sender = encryptedMessage.sender.toLowerCase(); // Normalize sender username
            encryptedMessage.recipient = encryptedMessage.recipient.toLowerCase(); // Normalize recipient username
            this.handleIncomingMessage(encryptedMessage);
        });

        socket.on('getPublicKey', (recipient, callback) => {
            recipient = recipient.toLowerCase(); // Normalize recipient username
            const user = this.users.get(recipient);
            if (user) {
                callback(user.publicKey);
            } else {
                callback(null);
            }
        });
    }

    handleDisconnect(username) {
        this.users.delete(username);
        logger.info(`User disconnected: ${username}`);
    }

    handleIncomingMessage(encryptedMessage) {
        try {
            console.log('Incoming message:', encryptedMessage); // Debug log
            console.log('Current users:', Array.from(this.users.keys())); // Log all registered users
            this.validateMessage(encryptedMessage);

            const sender = this.users.get(encryptedMessage.sender);
            if (!sender) {
                throw new Error(`Sender not found: ${encryptedMessage.sender}`);
            }

            const recipient = this.users.get(encryptedMessage.recipient);
            if (recipient) {
                console.log(`Routing message from ${encryptedMessage.sender} to ${encryptedMessage.recipient}`); // Debug log
                this.io.to(recipient.socketId).emit('message', {
                    ...encryptedMessage,
                    timestamp: new Date().toISOString()
                });
                logger.info(`Message routed: ${encryptedMessage.sender} -> ${encryptedMessage.recipient}`);
            } else {
                console.warn(`Recipient not found: ${encryptedMessage.recipient}`); // Debug log
                logger.warn(`Recipient not found: ${encryptedMessage.recipient}`);
            }
        } catch (error) {
            console.error('Error handling message:', error.message); // Debug log
            logger.error(`Message handling error: ${error.message}`);
        }
    }

    validateMessage(message) {
        if (!message.sender || !message.recipient || !message.data) {
            throw new Error('Invalid message format');
        }
    }

    start(port = process.env.PORT || 3000) {
        this.server.listen(port, () => {
            logger.info(`Server running on port ${port}`);
        });
    }
}

export default ChatServer;