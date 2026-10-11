/**
 * Custom Error Classes and Error Handling Utilities
 */

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(404, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(403, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(409, message, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = "Internal server error") {
    super(500, message);
  }
}

/**
 * Business logic errors
 */
export class InsufficientStockError extends AppError {
  constructor(bookName: string, available: number, requested: number) {
    super(
      400,
      `Insufficient stock for "${bookName}"`,
      { available, requested }
    );
  }
}

export class InvalidStockOperationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

/**
 * Error response formatter
 */
export function formatErrorResponse(error: any) {
  if (error instanceof AppError) {
    return {
      error: error.name.replace(/Error$/, ""),
      message: error.message,
      ...(error.details && { details: error.details }),
    };
  }

  // Zod validation errors
  if (error.name === "ZodError") {
    return {
      error: "ValidationError",
      message: "Invalid request data",
      details: error.errors,
    };
  }

  // Default error
  return {
    error: "InternalServerError",
    message: "An unexpected error occurred",
  };
}
