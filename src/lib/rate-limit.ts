import { NextResponse } from 'next/server';

type RateLimitConfig = {
  scope: string;
  maxRequests: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Bucket>();

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export function enforceRateLimit(req: Request, config: RateLimitConfig): NextResponse | null {
  const now = Date.now();
  const ip = getClientIp(req);
  const key = `${config.scope}:${ip}`;
  const bucket = store.get(key);

  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return null;
  }

  if (bucket.count >= config.maxRequests) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return NextResponse.json(
      {
        error: 'Demasiados pedidos. Tenta novamente em instantes.',
        retryAfterSec,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Limit': String(config.maxRequests),
          'X-RateLimit-Reset': String(bucket.resetAt),
        },
      },
    );
  }

  bucket.count += 1;
  store.set(key, bucket);
  return null;
}
