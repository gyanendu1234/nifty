import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error(`${req.method} ${req.path} – ${err.message}`, { stack: err.stack });

  const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500;
  const isDev = process.env.NODE_ENV !== 'production';
  const message = (statusCode < 500 || isDev) ? err.message : 'Internal server error';

  res.status(statusCode).json({ error: message });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}

export class AppError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'AppError';
  }
}
