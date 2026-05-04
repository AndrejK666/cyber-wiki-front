/**
 * HTTP status codes used across the app — single source of truth so
 * features don't redefine them as inline literals (`status === 401`) or
 * local enums.
 *
 * Add new entries lazily as features need them; keeping the enum small
 * avoids dragging unrelated codes into the bundle.
 */
export enum HttpStatus {
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
}

/**
 * Best-effort HTTP status extraction from a thrown error. The framework's
 * REST protocol uses axios under the hood, whose errors expose the upstream
 * status as `error.response.status`. Returns `undefined` for non-HTTP
 * failures (network drop, abort).
 */
export function extractHttpStatus(error: Error): number | undefined {
  const e = error as Error & { response?: { status?: number } };
  return e.response?.status;
}
