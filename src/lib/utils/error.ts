export class AppError extends Error {
  code: string;
  status?: number;
  details?: unknown;

  constructor(code: string, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const toAppError = (error: unknown, fallbackCode = 'UNKNOWN_ERROR'): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(fallbackCode, error.message);
  }

  return new AppError(fallbackCode, 'Unexpected error', undefined, error);
};
