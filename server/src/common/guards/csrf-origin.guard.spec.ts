import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { CsrfOriginGuard } from './csrf-origin.guard';

function makeContext(
  method: string,
  headers: Record<string, string | undefined>,
): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ method, headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('CsrfOriginGuard', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'FRONTEND_URL') return 'https://elite-drive-iota.vercel.app';
      if (key === 'ALLOW_VERCEL_PREVIEWS') return 'false';
      return undefined;
    }),
  } as unknown as ConfigService;

  it('allows an unsafe cookie-authenticated request from a trusted origin', () => {
    const guard = new CsrfOriginGuard(config);
    const context = makeContext('POST', {
      cookie: 'token=session-value',
      origin: 'https://elite-drive-iota.vercel.app',
      'sec-fetch-site': 'same-origin',
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects an unsafe cookie-authenticated request from an untrusted origin', () => {
    const guard = new CsrfOriginGuard(config);
    const context = makeContext('POST', {
      cookie: 'token=session-value',
      origin: 'https://attacker.example',
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects cross-site fetch metadata even when Origin is absent', () => {
    const guard = new CsrfOriginGuard(config);
    const context = makeContext('PATCH', {
      cookie: 'token=session-value',
      'sec-fetch-site': 'cross-site',
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows server-to-server unsafe requests without the browser session cookie', () => {
    const guard = new CsrfOriginGuard(config);
    const context = makeContext('POST', {
      origin: 'https://provider.example',
    });

    expect(guard.canActivate(context)).toBe(true);
  });
});
