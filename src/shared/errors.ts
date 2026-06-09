export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}
