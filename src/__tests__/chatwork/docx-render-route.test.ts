import AdmZip from 'adm-zip';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireFeatureAccess: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock('@/lib/api-auth', () => ({
  requireAuth: mocks.requireAuth,
  requireFeatureAccess: mocks.requireFeatureAccess,
}));

import { POST } from '../../app/api/chatwork/docx/render/route';

function createDocxBuffer() {
  const zip = new AdmZip();
  zip.addFile('word/document.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:rPr><w:b/><w:u w:val="single"/></w:rPr><w:t>Título formatado</w:t></w:r></w:p>
        <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Célula</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      </w:body>
    </w:document>`));
  return zip.toBuffer();
}

describe('POST /api/chatwork/docx/render', () => {
  it('renderiza DOCX para HTML com texto e tabela', async () => {
    mocks.requireAuth.mockResolvedValue({ user: { id: 'user-1' }, error: null });
    mocks.requireFeatureAccess.mockResolvedValue(null);

    const formData = new FormData();
    const buffer = createDocxBuffer();
    formData.append('file', new File([new Uint8Array(buffer)], 'documento.docx'));

    const response = await POST(new Request('http://localhost/api/chatwork/docx/render', { method: 'POST', body: formData }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.html).toContain('Título formatado');
    expect(data.html).toContain('<table>');
    expect(data.html).toContain('text-decoration:underline');
  });
});
