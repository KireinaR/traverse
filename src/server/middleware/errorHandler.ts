import { Request, Response, NextFunction } from 'express';
import { AxiosError } from 'axios';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError | AxiosError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Traverse Error]', err.message);

  // Translate raw axios HTTP errors into friendly messages
  const axErr = err as AxiosError;
  if (axErr.isAxiosError) {
    const status = axErr.response?.status;
    if (status === 403) {
      res.status(503).json({ error: 'A downstream API rejected the request (HTTP 403). Please try again in a moment.' });
      return;
    }
    if (status === 429) {
      res.status(429).json({ error: 'Too many requests to the road-network API. Please wait 10–15 seconds and try again.' });
      return;
    }
    if (axErr.code === 'ECONNABORTED') {
      res.status(504).json({ error: 'Road network request timed out. Try selecting points closer together.' });
      return;
    }
  }

  const appErr = err as AppError;
  res.status(appErr.statusCode || 500).json({
    error: appErr.message || 'Internal server error',
  });
}
