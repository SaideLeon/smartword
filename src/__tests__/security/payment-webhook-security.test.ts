import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnforceRateLimit = vi.fn();
const mockVerifySignature = vi.fn();
const mockConfirmAuto = vi.fn();
const mockRejectAuto = vi.fn();
const mockRegisterWebhookEventIfNew = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock('@/lib/paysuite', () => ({
  verifyPaySuiteWebhookSignature: mockVerifySignature,
}));

vi.mock('@/lib/payment-automation', () => ({
  confirmPaymentAutomaticallyByTransactionId: mockConfirmAuto,
  markPaymentAsRejectedByTransactionId: mockRejectAuto,
  registerWebhookEventIfNew: mockRegisterWebhookEventIfNew,
}));

import { POST } from '@/app/api/payment/webhook/route';

describe('Security suite — /api/payment/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockReturnValue(null);
    mockVerifySignature.mockReturnValue(true);
    mockConfirmAuto.mockResolvedValue({ ok: true, alreadyConfirmed: false });
    mockRejectAuto.mockResolvedValue({ ok: true });
    mockRegisterWebhookEventIfNew.mockResolvedValue({ isDuplicate: false });
  });

  it('recusa webhook com assinatura inválida', async () => {
    mockVerifySignature.mockReturnValue(false);

    const res = await POST(
      new Request('http://localhost/api/payment/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'payment.success', data: { id: 'ps_1' } }),
      }),
    );

    expect(res.status).toBe(401);
    expect(mockConfirmAuto).not.toHaveBeenCalled();
  });

  it('confirma automaticamente em payment.success', async () => {
    const res = await POST(
      new Request('http://localhost/api/payment/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-signature': 'abc',
        },
        body: JSON.stringify({ event: 'payment.success', request_id: 'req-1', data: { id: 'ps_1' } }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mockConfirmAuto).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 'ps_1' }),
    );
  });

  it('ignora webhook duplicado via request_id', async () => {
    mockRegisterWebhookEventIfNew.mockResolvedValueOnce({ isDuplicate: true });

    const res = await POST(
      new Request('http://localhost/api/payment/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-signature': 'abc',
        },
        body: JSON.stringify({ event: 'payment.success', request_id: 'req-duplicate', data: { id: 'ps_1' } }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mockConfirmAuto).not.toHaveBeenCalled();
  });
});
