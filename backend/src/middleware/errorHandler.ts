import { Request, Response, NextFunction } from 'express';
import Logger from '../utils/logger';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  Logger.error(`[Unhandled Error] ${req.method} ${req.url}`, err);

  const statusCode = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    status: 'ERROR',
    message: isProduction && statusCode === 500 ? 'Internal Server Error' : err.message,
    code: err.code || 'INTERNAL_ERROR',
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    status: 'ERROR',
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
  });
}
