import winston from 'winston';
import path from 'path';

const logDirectory = path.join(process.cwd(), 'logs');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug', // Set to 'debug' for development
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
      )
    }),
    new winston.transports.File({
      filename: path.join(logDirectory, 'combined.log'),
      level: 'info'
    }),
    new winston.transports.File({
      filename: path.join(logDirectory, 'errors.log'),
      level: 'error'
    })
  ]
});

export default logger;