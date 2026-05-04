import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";

export class AppError extends Error {
  statusCode: number;
  publicMessage: string;
  code: string;
  details?: Record<string, unknown>;

  constructor(publicMessage: string, options?: { statusCode?: number; code?: string; cause?: unknown; details?: Record<string, unknown> }) {
    super(publicMessage);
    this.statusCode = options?.statusCode ?? 400;
    this.publicMessage = publicMessage;
    this.code = options?.code ?? "APP_ERROR";
    this.details = options?.details;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

export function logStructuredError(scope: string, error: unknown, details?: Record<string, unknown>) {
  const payload = {
    scope,
    message: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined,
    details
  };
  console.error(JSON.stringify(payload));
}

export async function captureFailureLog(options: {
  scope: string;
  action: string;
  userId?: string | null;
  entityType: string;
  entityId?: string | null;
  error: unknown;
  details?: Record<string, unknown>;
}) {
  logStructuredError(options.scope, options.error, options.details);
  try {
    await logAction(options.userId ?? null, options.action, options.entityType, options.entityId ?? null, {
      ...(options.details ?? {}),
      error: options.error instanceof Error ? options.error.message : "Unknown error"
    });
  } catch (auditError) {
    logStructuredError(`${options.scope}.audit`, auditError, { action: options.action });
  }
}

export function getSafeErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof AppError) return error.publicMessage;
  return fallback;
}

export function getStatusCode(error: unknown, fallback = 500) {
  if (error instanceof AppError) return error.statusCode;
  return fallback;
}

type WrapOptions = {
  scope: string;
  action?: string;
  entityType?: string;
  fallbackMessage?: string;
};

/**
 * Wrap an API route handler with structured error handling.
 * Catches thrown errors, logs them via captureFailureLog, and returns a sanitized JSON response.
 * Use as: export const POST = withApi({ scope: "applicant.profile" }, async (request, ctx) => { ... });
 */
export function withApi<T extends unknown[], R>(
  options: WrapOptions,
  handler: (...args: T) => Promise<R>
) {
  return async function wrappedHandler(...args: T) {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error, {
        scope: options.scope,
        action: options.action ?? "api_failure",
        entityType: options.entityType ?? "api",
        fallbackMessage: options.fallbackMessage ?? "Something went wrong. Please try again."
      });
    }
  };
}

export async function handleApiError(
  error: unknown,
  options: {
    scope: string;
    action: string;
    userId?: string | null;
    entityType: string;
    entityId?: string | null;
    details?: Record<string, unknown>;
    fallbackMessage?: string;
  }
) {
  await captureFailureLog({
    scope: options.scope,
    action: options.action,
    userId: options.userId,
    entityType: options.entityType,
    entityId: options.entityId,
    error,
    details: options.details
  });

  return NextResponse.json(
    { error: getSafeErrorMessage(error, options.fallbackMessage) },
    { status: getStatusCode(error) }
  );
}
