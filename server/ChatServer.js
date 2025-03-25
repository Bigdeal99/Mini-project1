import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import logger from './utils/logger.js';
import { validateMessage } from './utils/validators.js';
import rateLimit from 'express-rate-limit';
import path from 'path';

export default class ChatServer {
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

    this.configureMiddleware();
    this.configureRoutes();
    this.configureSocket();
  }

  configureMiddleware() {
    const clientPath = path.resolve('d:/EASV/Mini-project1/client/public');
    this.app.use(express.static(clientPath));
    this.app.use(rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100
    }));
  }

  configureRoutes() {
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        users: this.users.size
      });
    });

    // Fallback route to serve index.html for all other routes
    this.app.get('*', (req, res) => {
      res.sendFile(path.resolve('d:/EASV/Mini-project1/client/index.html'));
    });
  }

  configureSocket() {
    this.io.use(this.authenticateConnection.bind(this));
    this.io.on('connection', this.handleConnection.bind(this));
  }

  authenticateConnection(socket, next) {
    const { username, publicKey } = socket.handshake.auth;
    if (!username || !publicKey || this.users.has(username)) {
      logger.error(`Connection rejected: ${username}`);
      return next(new Error('Authentication failed'));
    }
    next();
  }

  handleConnection(socket) {
    const { username, publicKey } = socket.handshake.auth;

    this.users.set(username, {
      socketId: socket.id,
      publicKey,
      connectedAt: new Date()
    });

    logger.info(`User connected: ${username}`);

    socket.on('message', (message) => {
      try {
        validateMessage(message);
        this.routeMessage(message);
      } catch (error) {
        logger.error(`Invalid message: ${error.message}`);
      }
    });

    socket.on('disconnect', () => {
      this.users.delete(username);
      logger.info(`User disconnected: ${username}`);
    });
  }

  routeMessage(message) {
    const recipient = this.users.get(message.recipient);
    if (!recipient) {
      logger.warn(`Recipient not found: ${message.recipient}`);
      return;
    }
    
    this.io.to(recipient.socketId).emit('message', {
      ...message,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`Message routed: ${message.sender} -> ${message.recipient}`);
  }

  start(port = 3000) {
    this.server.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });
  }
}