import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnforceRateLimit = vi.fn();
const mockMarkSectionInserted = vi.fn();
const mockMarkWorkSectionInserted = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock('@/lib/tcc/service', () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  listSessions: vi.fn(),
  deleteSession: vi.fn(),
  saveTccCoverData: vi.fn(),
  markSectionInserted: mockMarkSectionInserted,
}));

vi.mock('@/lib/work/service', () => ({
  createWorkSession: vi.fn(),
  getWorkSession: vi.fn(),
  listWorkSessions: vi.fn(),
  deleteWorkSession: vi.fn(),
  saveWorkCoverData: vi.fn(),
  markWorkSectionInserted: mockMarkWorkSectionInserted,
}));

import { POST as postTccSession } from '@/app/api/tcc/session/route';
import { POST as postWorkSession } from '@/app/api/work/session/route';

describe('Security — session mass assignment (R18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(null);
    mockMarkSectionInserted.mockResolvedValue(undefined);
    mockMarkWorkSectionInserted.mockResolvedValue(undefined);
  });

  it('TCC markInserted ignora sections enviado pelo cliente', async () => {
    const req = new Request('http://localhost/api/tcc/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _action: 'markInserted',
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        sectionIndex: 2,
        sections: [{ index: 2, content: 'ADULTERADO', status: 'inserted' }],
      }),
    });

    const res = await postTccSession(req);

    expect(res.status).toBe(200);
    expect(mockMarkSectionInserted).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', 2);
  });

  it('WORK markInserted ignora sections enviado pelo cliente', async () => {
    const req = new Request('http://localhost/api/work/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _action: 'markInserted',
        sessionId: '123e4567-e89b-12d3-a456-426614174001',
        sectionIndex: 1,
        sections: [{ index: 1, content: 'ADULTERADO', status: 'inserted' }],
      }),
    });

    const res = await postWorkSession(req);

    expect(res.status).toBe(200);
    expect(mockMarkWorkSectionInserted).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174001', 1);
  });

  it('TCC markInserted rejeita sem sectionIndex numérico', async () => {
    const req = new Request('http://localhost/api/tcc/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'markInserted', sessionId: '123e4567-e89b-12d3-a456-426614174000', sectionIndex: '2' }),
    });

    const res = await postTccSession(req);

    expect(res.status).toBe(400);
    expect(mockMarkSectionInserted).not.toHaveBeenCalled();
  });
});
