import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireFeatureAccess: vi.fn(),
  extractRawText: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/api-auth', () => ({
  requireAuth: mocks.requireAuth,
  requireFeatureAccess: mocks.requireFeatureAccess,
}));
vi.mock('mammoth', () => ({
  default: { extractRawText: mocks.extractRawText },
}));

import { POST } from '../../app/api/chatwork/docx/preview/route';

describe('POST /api/chatwork/docx/preview', () => {
  it('converte texto extraído do DOCX para markdown de workspace', async () => {
    mocks.requireAuth.mockResolvedValue({ user: { id: 'user-1' }, error: null });
    mocks.requireFeatureAccess.mockResolvedValue(null);
    mocks.extractRawText.mockResolvedValue({ value: 'Título\n\nPrimeiro parágrafo', messages: [] });

    const formData = new FormData();
    formData.append('file', new File(['fake'], 'documento.docx'));

    const response = await POST(new Request('http://localhost/api/chatwork/docx/preview', { method: 'POST', body: formData }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.markdown).toBe('# Título\n\nPrimeiro parágrafo');
  });
});
