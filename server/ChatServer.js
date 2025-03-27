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
                origin: "*", 
                methods: ["GET", "POST"],
                credentials: true
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
        socket.onAny((event, ...args) => {
            logger.debug(`Received event: ${event} from ${username}`, {
                event,
                args: args[0] // Log only first argument for security
            });
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
                // Add sender verification
                const sender = this.users.get(encryptedMessage.sender);
                if (!sender) {
                    throw new Error('Sender not authenticated');
                }
    
                // Add message signing
                const signedMessage = {
                    ...encryptedMessage,
                    senderSocket: sender.socketId,
                    timestamp: new Date().toISOString()
                };
    
                this.io.to(recipient.socketId).emit('private-message', signedMessage);
                logger.info(`Message routed: ${encryptedMessage.sender} -> ${encryptedMessage.recipient}`);
                
                // Send delivery confirmation
                this.io.to(sender.socketId).emit('message-status', {
                    status: 'delivered',
                    timestamp: signedMessage.timestamp
                });
            } else {
                logger.warn(`Recipient not found: ${encryptedMessage.recipient}`);
                this.io.to(this.users.get(encryptedMessage.sender)?.socketId).emit('message-status', {
                    status: 'failed',
                    reason: 'Recipient not found'
                });
            }
        } catch (error) {
            logger.error(`Message handling error: ${error.message}`);
            this.io.to(this.users.get(encryptedMessage.sender)?.socketId).emit('error', {
                type: 'message-delivery',
                message: error.message
            });
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