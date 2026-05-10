import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { logger } from './config/logger';

const PORT = parseInt(process.env.PORT ?? '4000', 10);

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`AMFI Ladder API running on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`);
});

const shutdown = (signal: string) => {
  logger.info(`Received ${signal}. Graceful shutdown...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  process.exit(1);
});
