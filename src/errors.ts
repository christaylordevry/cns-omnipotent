export type ErrorCode =
  | "VAULT_BOUNDARY"
  | "PROTECTED_PATH"
  | "SCHEMA_INVALID"
  | "SECRET_PATTERN"
  | "IO_ERROR"
  | "NOT_FOUND"
  | "UNSUPPORTED";

export class CnsError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CnsError";
    this.code = code;
    this.details = details;
  }
}

