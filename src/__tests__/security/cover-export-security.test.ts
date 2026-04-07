import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnforceRateLimit = vi.fn();
const mockGenerateDocxWithCover = vi.fn();
const mockValidateBase64Image = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock('@/lib/docx', () => ({
  generateDocxWithCover: mockGenerateDocxWithCover,
}));

vi.mock('@/lib/validation/image-validator', () => ({
  validateBase64Image: mockValidateBase64Image,
}));

import { POST } from '@/app/api/cover/export/route';

describe('Security suite — /api/cover/export (R13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(null);
    mockGenerateDocxWithCover.mockResolvedValue(new ArrayBuffer(16));
    mockValidateBase64Image.mockReturnValue(new Uint8Array([0xff, 0xd8, 0xff]));
  });

  it('sanitiza filename para evitar header injection no Content-Disposition', async () => {
    const req = new Request('http://localhost/api/cover/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coverData: {},
        markdown: '# Teste',
        filename: 'evil"\r\nX-Injected: yes',
      }),
    });

    const res = await POST(req);
    const contentDisposition = res.headers.get('Content-Disposition') ?? '';

    expect(res.status).toBe(200);
    expect(contentDisposition).toContain('attachment; filename="evil-.docx"');
    expect(contentDisposition).not.toContain('\r');
    expect(contentDisposition).not.toContain('\n');
    expect(contentDisposition).not.toContain('X-Injected');
  });
});
