import crypto from 'crypto';

const PAYSUITE_BASE_URL = process.env.PAYSUITE_API_BASE_URL?.trim() || 'https://paysuite.tech/api/v1';

export type PaySuiteMethod = 'mpesa' | 'emola' | 'credit_card';

export type PaySuiteCreatePaymentInput = {
  amountMzn: number;
  reference: string;
  description: string;
  method: PaySuiteMethod;
  returnUrl?: string;
  callbackUrl?: string;
};

export type PaySuiteCreatePaymentResult = {
  id: string;
  amount: number;
  reference: string;
  status: string;
  checkoutUrl: string | null;
};

export type PaySuitePaymentStatusResult = {
  id: string;
  reference: string;
  status: string;
  transactionStatus: string | null;
};

function getApiToken(): string {
  const token = process.env.PAYSUITE_API_TOKEN?.trim();
  if (!token) {
    throw new Error('PAYSUITE_API_TOKEN não configurado');
  }
  return token;
}

async function parseJsonSafe(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function createPaySuitePaymentRequest(input: PaySuiteCreatePaymentInput): Promise<PaySuiteCreatePaymentResult> {
  const token = getApiToken();
  const payload = {
    amount: input.amountMzn.toFixed(2),
    reference: input.reference,
    description: input.description.slice(0, 125),
    method: input.method,
    ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
    ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
  };

  const res = await fetch(`${PAYSUITE_BASE_URL}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const json = await parseJsonSafe(res);
  if (!res.ok || json?.status !== 'success' || !json?.data?.id) {
    const apiMessage = json?.message || `HTTP ${res.status}`;
    throw new Error(`PaySuite create payment falhou: ${apiMessage}`);
  }

  return {
    id: String(json.data.id),
    amount: Number(json.data.amount ?? input.amountMzn),
    reference: String(json.data.reference ?? input.reference),
    status: String(json.data.status ?? 'pending'),
    checkoutUrl: typeof json.data.checkout_url === 'string' ? json.data.checkout_url : null,
  };
}

export async function getPaySuitePaymentStatus(paymentId: string): Promise<PaySuitePaymentStatusResult> {
  const token = getApiToken();

  const res = await fetch(`${PAYSUITE_BASE_URL}/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const json = await parseJsonSafe(res);
  if (!res.ok || json?.status !== 'success' || !json?.data?.id) {
    const apiMessage = json?.message || `HTTP ${res.status}`;
    throw new Error(`PaySuite get payment falhou: ${apiMessage}`);
  }

  return {
    id: String(json.data.id),
    reference: String(json.data.reference ?? ''),
    status: String(json.data.status ?? 'pending'),
    transactionStatus:
      typeof json.data.transaction?.status === 'string' ? json.data.transaction.status : null,
  };
}

export function verifyPaySuiteWebhookSignature(payload: string, signature: string | null): boolean {
  const secret = process.env.PAYSUITE_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;

  const digest = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function generatePaySuiteReference(planKey: string, userId: string): string {
  const entropy = crypto.randomBytes(4).toString('hex').toUpperCase();
  const compactUser = userId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `MNR-${planKey.slice(0, 8).toUpperCase()}-${compactUser}-${entropy}`.slice(0, 50);
}

export function isPaySuitePaidStatus(status: string | null | undefined, transactionStatus: string | null | undefined): boolean {
  const normalizedStatus = (status ?? '').toLowerCase();
  const normalizedTransactionStatus = (transactionStatus ?? '').toLowerCase();
  return normalizedStatus === 'paid' || normalizedTransactionStatus === 'completed';
}
