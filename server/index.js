import ChatServer from './ChatServer.js';
import logger from './utils/logger.js';

const server = new ChatServer();

try {
  server.start();
  logger.info('Chat server started successfully');
} catch (error) {
  logger.error(`Failed to start the server: ${error.message}`);
  process.exit(1);
}

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
});