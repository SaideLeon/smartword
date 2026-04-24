interface AffiliateCommission {
  id: string;
  payment_amount_mzn: number;
  commission_mzn: number;
  commission_rate: number;
  status: string;
  created_at: string;
}

interface ReferredUser {
  full_name: string | null;
  email: string | null;
}

interface AffiliateReferral {
  id: string;
  status: string;
  registered_at: string;
  converted_at: string | null;
  referred_user?: ReferredUser | null;
  commissions?: AffiliateCommission[] | null;
}

interface AffiliateReferralsTableProps {
  referrals: AffiliateReferral[];
}

const moneyFormatter = new Intl.NumberFormat('pt-MZ', {
  style: 'currency',
  currency: 'MZN',
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function AffiliateReferralsTable({ referrals }: AffiliateReferralsTableProps) {
  if (referrals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
        Ainda não existem indicações registradas. Compartilhe seu link para começar.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface2)] text-[var(--faint)]">
            <tr>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em]">Usuário</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em]">Status</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em]">Registro</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em]">Comissões</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((item) => {
              const totalCommissions = (item.commissions ?? []).reduce((sum, commission) => sum + commission.commission_mzn, 0);
              return (
                <tr key={item.id} className="border-b border-[var(--border)]/70 last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--ink)]">{item.referred_user?.full_name || 'Sem nome'}</p>
                    <p className="text-xs text-[var(--muted)]">{item.referred_user?.email || 'Sem email'}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{item.status}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{dateFormatter.format(new Date(item.registered_at))}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--ink)]">{moneyFormatter.format(totalCommissions)}</p>
                    <p className="text-xs text-[var(--muted)]">{(item.commissions ?? []).length} pagamentos</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
