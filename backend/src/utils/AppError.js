/** Custom error với HTTP status */
export class AppError extends Error {
  constructor(message, statusCode = 500, fieldOrErrors = null, errors = null) {
    super(message);
    this.statusCode = statusCode;

    // Support both: new AppError(msg, 400, 'fieldName')
    // and:         new AppError(msg, 400, [{...}])
    // and:         new AppError(msg, 400, 'fieldName', [{...}])
    if (typeof fieldOrErrors === 'string') {
      this.field = fieldOrErrors;
      this.errors = errors;
    } else {
      this.field = null;
      this.errors = fieldOrErrors;
    }

    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
