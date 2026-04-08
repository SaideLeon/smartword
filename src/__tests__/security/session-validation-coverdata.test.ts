import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnforceRateLimit = vi.fn();
const mockMarkSectionInserted = vi.fn();
const mockMarkWorkSectionInserted = vi.fn();
const mockSaveTccCoverData = vi.fn();
const mockSaveWorkCoverData = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock('@/lib/tcc/service', () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  listSessions: vi.fn(),
  deleteSession: vi.fn(),
  markSectionInserted: mockMarkSectionInserted,
  saveTccCoverData: mockSaveTccCoverData,
}));

vi.mock('@/lib/work/service', () => ({
  createWorkSession: vi.fn(),
  getWorkSession: vi.fn(),
  listWorkSessions: vi.fn(),
  deleteWorkSession: vi.fn(),
  markWorkSectionInserted: mockMarkWorkSectionInserted,
  saveWorkCoverData: mockSaveWorkCoverData,
}));

import { POST as postTccSession } from '@/app/api/tcc/session/route';
import { POST as postWorkSession } from '@/app/api/work/session/route';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

const validCoverData = {
  institution: 'Instituição',
  course: 'Curso',
  subject: 'Disciplina',
  theme: 'Tema',
  members: ['Aluno 1', 'Aluno 2'],
  teacher: 'Professor',
  city: 'Maputo',
  date: 'Abril de 2026',
};

describe('Security — R09/R07 em session routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(null);
    mockMarkSectionInserted.mockResolvedValue(undefined);
    mockMarkWorkSectionInserted.mockResolvedValue(undefined);
    mockSaveTccCoverData.mockResolvedValue(undefined);
    mockSaveWorkCoverData.mockResolvedValue(undefined);
  });

  it('rejeita markInserted com sessionId inválido (R09)', async () => {
    const req = new Request('http://localhost/api/tcc/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'markInserted', sessionId: 'sess-1', sectionIndex: 0 }),
    });

    const res = await postTccSession(req);

    expect(res.status).toBe(400);
    expect(mockMarkSectionInserted).not.toHaveBeenCalled();
  });

  it('rejeita markInserted com sectionIndex não inteiro (R09)', async () => {
    const req = new Request('http://localhost/api/work/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'markInserted', sessionId: VALID_UUID, sectionIndex: -1 }),
    });

    const res = await postWorkSession(req);

    expect(res.status).toBe(400);
    expect(mockMarkWorkSectionInserted).not.toHaveBeenCalled();
  });

  it('rejeita saveCoverData com payload demasiado grande (R07)', async () => {
    const req = new Request('http://localhost/api/tcc/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _action: 'saveCoverData',
        sessionId: VALID_UUID,
        coverData: { ...validCoverData, abstract: 'A'.repeat(6001) },
      }),
    });

    const res = await postTccSession(req);

    expect(res.status).toBe(400);
    expect(mockSaveTccCoverData).not.toHaveBeenCalled();
  });

  it('aceita saveCoverData válido (R07)', async () => {
    const req = new Request('http://localhost/api/work/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _action: 'saveCoverData',
        sessionId: VALID_UUID,
        coverData: validCoverData,
      }),
    });

    const res = await postWorkSession(req);

    expect(res.status).toBe(200);
    expect(mockSaveWorkCoverData).toHaveBeenCalledWith(VALID_UUID, validCoverData);
  });
});
