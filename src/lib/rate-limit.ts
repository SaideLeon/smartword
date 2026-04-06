import { NextResponse } from 'next/server';

type RateLimitConfig = {
  scope: string;
  maxRequests: number;
  windowMs: number;
};

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

async function upstashCommand<T>(...parts: Array<string | number>): Promise<T> {
  if (!redisUrl || !redisToken) {
    throw new Error('Upstash não configurado');
  }

  const encoded = parts
    .map((part) => encodeURIComponent(String(part)))
    .join('/');

  const res = await fetch(`${redisUrl}/${encoded}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Erro no Upstash (${res.status})`);
  }

  const payload = await res.json();
  return payload.result as T;
}

export async function enforceRateLimit(req: Request, config: RateLimitConfig): Promise<NextResponse | null> {
  if (!redisUrl || !redisToken) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Rate limit indisponível no servidor.' }, { status: 503 });
    }
    return null;
  }

  const ip = getClientIp(req);
  const key = `muneri:rl:${config.scope}:${ip}`;

  try {
    const count = await upstashCommand<number>('incr', key);
    if (count === 1) {
      await upstashCommand<number>('pexpire', key, config.windowMs);
    }

    const ttlMs = await upstashCommand<number>('pttl', key);
    const resetAt = Date.now() + Math.max(0, ttlMs);

    if (count > config.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil(Math.max(0, ttlMs) / 1000));
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
            'X-RateLimit-Reset': String(resetAt),
          },
        },
      );
    }

    return null;
  } catch {
    return NextResponse.json({ error: 'Falha no serviço de rate limit.' }, { status: 503 });
  }
}
