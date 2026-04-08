import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockCreateClient = vi.fn();
const mockRequireUserId = vi.fn();

vi.mock('@/lib/supabase', () => ({
  createClient: mockCreateClient,
  requireUserId: mockRequireUserId,
}));

describe('Security — defesa em profundidade de sessão (R22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const queryBuilder = {
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    };

    mockSelect.mockReturnValue(queryBuilder);
    mockEq.mockReturnValue(queryBuilder);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(queryBuilder);
    mockCreateClient.mockResolvedValue({ from: mockFrom });
  });

  it('TCC getSession aplica filtro por user_id', async () => {
    mockRequireUserId.mockResolvedValue('user-tcc');

    const { getSession } = await import('@/lib/tcc/service');
    await getSession('session-tcc');

    expect(mockEq).toHaveBeenCalledWith('id', 'session-tcc');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-tcc');
  });

  it('WORK getWorkSession aplica filtro por user_id', async () => {
    mockRequireUserId.mockResolvedValue('user-work');

    const { getWorkSession } = await import('@/lib/work/service');
    await getWorkSession('session-work');

    expect(mockEq).toHaveBeenCalledWith('id', 'session-work');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-work');
  });
});
