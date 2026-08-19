import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import {
  buildTrustedOrigins,
  isTrustedFrontendOrigin,
  TrustedOriginsConfig,
} from '../security/trusted-origins';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SESSION_COOKIE = 'token';

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hasSessionCookie(cookieHeader?: string) {
  if (!cookieHeader) return false;
  return cookieHeader.split(';').some((part) => {
    const [name] = part.trim().split('=', 1);
    return name === SESSION_COOKIE;
  });
}

@Injectable()
export class CsrfOriginGuard implements CanActivate {
  private readonly trustedOrigins: TrustedOriginsConfig;

  constructor(config: ConfigService) {
    this.trustedOrigins = buildTrustedOrigins(
      config.get<string>('FRONTEND_URL'),
      config.get<string>('ALLOW_VERCEL_PREVIEWS') === 'true',
    );
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
    if (!hasSessionCookie(request.headers.cookie)) return true;

    const fetchSite = firstHeaderValue(request.headers['sec-fetch-site']);
    if (fetchSite === 'cross-site') {
      throw new ForbiddenException('Cross-site session request is not allowed');
    }

    const origin = firstHeaderValue(request.headers.origin);
    if (!origin) {
      throw new ForbiddenException('Session request origin is required');
    }

    if (!isTrustedFrontendOrigin(origin, this.trustedOrigins)) {
      throw new ForbiddenException('Request origin is not allowed');
    }

    return true;
  }
}
