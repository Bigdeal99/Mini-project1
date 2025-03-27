import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import logger from './logger.js';
import path from 'path'; // Use import instead of require
import { fileURLToPath } from 'url'; // Needed to resolve __dirname in ES modules

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
        const __filename = fileURLToPath(import.meta.url); // Resolve current file path
        const __dirname = path.dirname(__filename); // Resolve directory name
        this.app.use(express.static(path.join(__dirname, '../client'))); // Serve static files from the client directory
        this.app.use(express.json());
    }

    initializeRoutes() {
        this.app.get('/health', (req, res) => {
            res.status(200).json({ status: 'ok', users: this.users.size });
        });
    }

    initializeSocket() {
        this.io = new Server(this.server, {
            cors: {
                origin: "http://localhost:3000", // Ensure this matches your client URL
                methods: ["GET", "POST"]
            }
        });
        this.io.use(this.authenticateConnection.bind(this));
        this.io.on('connection', this.handleConnection.bind(this));
    }

    authenticateConnection(socket, next) {
        const username = socket.handshake.auth.username;
        if (!username || this.users.has(username)) {
            return next(new Error('Invalid or duplicate username'));
        }
        next();
    }

    handleConnection(socket) {
        const username = socket.handshake.auth.username;
        const publicKey = socket.handshake.auth.publicKey;

        this.users.set(username, {
            socketId: socket.id,
            publicKey,
            connectedAt: new Date()
        });

        logger.info(`User connected: ${username} (${socket.id})`);

        socket.on('disconnect', () => {
            this.handleDisconnect(username);
        });

        socket.on('message', (encryptedMessage) => {
            this.handleIncomingMessage(encryptedMessage);
        });

        socket.on('get-public-key', (recipient, callback) => {
            try {
                const user = this.users.get(recipient);
                if (user) {
                    callback({ publicKey: user.publicKey });
                } else {
                    callback({ error: 'User not found' });
                }
            } catch (error) {
                callback({ error: error.message });
            }
        });
    }

    handleDisconnect(username) {
        this.users.delete(username);
        logger.info(`User disconnected: ${username}`);
    }

    handleIncomingMessage(encryptedMessage) {
        try {
            this.validateMessage(encryptedMessage);
            const recipient = this.users.get(encryptedMessage.recipient);
    
            if (recipient) {
                this.io.to(recipient.socketId).emit('private-message', encryptedMessage); // Emit to recipient
                logger.info(`Message routed: ${encryptedMessage.sender} -> ${encryptedMessage.recipient}`);
            } else {
                this.io.to(this.users.get(encryptedMessage.sender)?.socketId).emit('user-status', 
                    'Recipient not found or offline');
                logger.warn(`Recipient not found: ${encryptedMessage.recipient}`);
            }
        } catch (error) {
            logger.error(`Message handling error: ${error.message}`);
            this.io.to(this.users.get(encryptedMessage.sender)?.socketId).emit('error', 
                'Message delivery failed');
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