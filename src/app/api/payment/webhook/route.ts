import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { enforceRateLimit } from '@/lib/rate-limit';
import {
  markPaymentAsRejectedByTransactionId,
  confirmPaymentAutomaticallyByTransactionId,
  registerWebhookEventIfNew,
} from '@/lib/payment-automation';
import { verifyPaySuiteWebhookSignature } from '@/lib/paysuite';

type PaySuiteWebhookPayload = {
  event?: string;
  request_id?: string;
  data?: {
    id?: string;
    reference?: string;
    error?: string;
  };
};

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'payment:webhook', maxRequests: 120, windowMs: 60_000 });
  if (limited) return limited;

  const rawPayload = await req.text();
  const signature = req.headers.get('x-webhook-signature');
  if (!verifyPaySuiteWebhookSignature(rawPayload, signature)) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 });
  }

  let body: PaySuiteWebhookPayload;
  try {
    body = JSON.parse(rawPayload) as PaySuiteWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  const event = (body.event || '').trim();
  const providerPaymentId = (body.data?.id || '').trim();
  const requestId = (body.request_id || '').trim() || crypto.createHash('sha256').update(rawPayload).digest('hex');

  if (!event || !providerPaymentId) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
  }

  try {
    const webhookEvent = await registerWebhookEventIfNew({
      requestId,
      eventType: event,
      providerPaymentId,
      payload: body,
    });
    if (webhookEvent.isDuplicate) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (event === 'payment.success') {
      const result = await confirmPaymentAutomaticallyByTransactionId({
        transactionId: providerPaymentId,
        notes: `PaySuite webhook success (${requestId})`,
      });
      return NextResponse.json({ ok: true, result });
    }

    if (event === 'payment.failed') {
      const result = await markPaymentAsRejectedByTransactionId({
        transactionId: providerPaymentId,
        notes: `PaySuite webhook failed: ${body.data?.error ?? 'sem detalhe'}`,
      });
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ ok: true, ignored: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Falha ao processar webhook' }, { status: 500 });
  }
}
