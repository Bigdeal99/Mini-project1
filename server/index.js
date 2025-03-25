import ChatServer from './ChatServer.js';

const server = new ChatServer();

try {
    server.start();
} catch (error) {
    console.error('Failed to start the server:', error);
}