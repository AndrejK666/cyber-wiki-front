import { RestPlugin, eventBus } from '@cyberfabric/react';
import type {
  ApiPluginErrorContext,
  RestRequestContext,
  RestResponseContext,
  RestShortCircuitResponse,
} from '@cyberfabric/react';
import { HttpStatus, extractHttpStatus } from '@/app/lib/httpStatus';

const TOKEN_KEY = 'cyberwiki_auth_token';

export class AuthPlugin extends RestPlugin {
  onRequest(
    context: RestRequestContext,
  ): RestRequestContext | RestShortCircuitResponse {
    const token = AuthPlugin.getToken();
    if (!token) {
      return context;
    }

    return {
      ...context,
      headers: {
        ...context.headers,
        Authorization: `Bearer ${token}`,
      },
    };
  }

  /**
   * Catch 401s from any backend call (session expiry, revoked token) so the
   * app drops out of authenticated state and `App.tsx` swaps to `LoginPage`.
   * The error is still returned as-is so the original caller's error path
   * (toast, retry button, …) keeps working.
   */
  onError(context: ApiPluginErrorContext): Error | RestResponseContext {
    if (extractHttpStatus(context.error) === HttpStatus.Unauthorized) {
      AuthPlugin.clearToken();
      eventBus.emit('app/auth/state', { authenticated: false });
    }
    return context.error;
  }

  static saveToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  static getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  static clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }
}
