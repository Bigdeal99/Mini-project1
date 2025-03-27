import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import logger from './utils/logger.js';
import { validateMessage } from './utils/validators.js';
import path from 'path';
import helmet from 'helmet';

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
    this.app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                connectSrc: ["'self'", "ws://localhost:3000"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"]
            }
        }
    }));
    this.app.use(express.static('public'));
    logger.info('Middleware configured');
}

  configureRoutes() {
    this.app.get('/users', (req, res) => {
      res.json(Array.from(this.users.keys()));
    });
    logger.info('Routes configured');
  }

  configureSocket() {
    this.io.use(this.authenticateConnection.bind(this));
    this.io.on('connection', this.handleConnection.bind(this));
    logger.info('Socket configured');
  }

  authenticateConnection(socket, next) {
    const { username, publicKey } = socket.handshake.auth;

    logger.debug(`Authentication attempt: username=${username}, publicKey=${publicKey}`);

    if (!username || !publicKey) {
        logger.warn(`Authentication failed for socket: ${socket.id}`);
        return next(new Error('Authentication failed'));
    }

    if (this.users.has(username)) {
        logger.warn(`Username already taken: ${username}`);
        return next(new Error('Username already taken'));
    }

    logger.info(`Authentication successful for username: ${username}`);
    next();
}

handleConnection(socket) {
  const { username, publicKey } = socket.handshake.auth;

  // Validate public key format
  if (!publicKey.match(/^[A-Za-z0-9+/]+={0,2}$/)) {
      socket.disconnect(true);
      return logger.error(`Invalid public key format for user: ${username}`);
  }

  // Store user information
  this.users.set(username, {
      socketId: socket.id,
      publicKey,
      connectedAt: new Date()
  });

  // Broadcast updated user list
  this.io.emit('user_list', Array.from(this.users.keys()));
  
  // Confirm registration
  socket.emit('registration_success', {
      username,
      timestamp: new Date().toISOString()
  });

    logger.info(`User connected: ${username}`);
    this.users.set(username, {
        socketId: socket.id,
        publicKey,
        connectedAt: new Date()
    });

    logger.debug(`Current users: ${Array.from(this.users.keys()).join(', ')}`);

    this.io.emit('user_list', Array.from(this.users.keys()));

    socket.emit('system_message', {
        type: 'welcome',
        message: `Welcome ${username}! There are ${this.users.size - 1} other users online.`
    });

    socket.on('message', (message) => {
        try {
            validateMessage(message);
            this.routeMessage(message);
        } catch (error) {
            logger.error(`Invalid message from ${message.sender}: ${error.message}`);
        }
    });

    socket.on('disconnect', () => {
        this.users.delete(username);
        this.io.emit('user_list', Array.from(this.users.keys()));
        logger.info(`User disconnected: ${username}`);
        logger.info(`User disconnected: ${username}`);
    });
}
configureRoutes() {
  this.app.get('/public-key/:username', (req, res) => {
      const user = this.users.get(req.params.username);
      if (!user) return res.status(404).send('User not found');
      res.json({ publicKey: user.publicKey });
  });
}
  routeMessage(message) {
    const recipient = this.users.get(message.recipient);
    const sender = this.users.get(message.sender);

    if (!recipient) {
      logger.warn(`Recipient not found: ${message.recipient}`);
      return;
    }

    // Send to recipient
    this.io.to(recipient.socketId).emit('message', message);
    
    // Send confirmation to sender
    this.io.to(sender.socketId).emit('message_status', {
      id: message.id,
      status: 'delivered'
    });

    logger.info(`Message routed from ${message.sender} to ${message.recipient}`);
  }

  start(port = 3000) {
    this.server.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });
  }
}