import { createHash, randomBytes } from 'node:crypto';

export type PremiumLinkValidation = {
  ok: boolean;
  reason?:
    | 'not_found'
    | 'revoked'
    | 'expired'
    | 'already_used';
};

export function generatePremiumAccessToken() {
  return randomBytes(32).toString('base64url');
}

export function hashPremiumAccessToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function validatePremiumLinkState(link: {
  revoked_at: string | null;
  expires_at: string | null;
  uses_count: number;
  max_uses: number;
} | null): PremiumLinkValidation {
  if (!link) return { ok: false, reason: 'not_found' };
  if (link.revoked_at) return { ok: false, reason: 'revoked' };

  if (link.expires_at) {
    const exp = new Date(link.expires_at);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() <= Date.now()) {
      return { ok: false, reason: 'expired' };
    }
  }

  if (link.uses_count >= link.max_uses) {
    return { ok: false, reason: 'already_used' };
  }

  return { ok: true };
}
