'use client';

/**
 * useEduEligibility
 *
 * Utilitário client-side para detectar se um e-mail pertence a um domínio
 * educativo (contém 'edu' como segmento isolado no domínio).
 *
 * IMPORTANTE: esta verificação é apenas para UX (mostrar/esconder UI).
 * A concessão real do plano Premium é feita exclusivamente no servidor
 * via a função SQL grant_edu_premium_trial (migração 019).
 *
 * O benefício só é concedido se o utilizador usar Google OAuth.
 * Esta função não verifica isso — é apenas para feedback visual.
 */
export function isEduEmailDomain(email: string): boolean {
  const atIdx = email.lastIndexOf('@');
  if (atIdx === -1) return false;

  const domain = email.slice(atIdx + 1).toLowerCase().trim();
  if (!domain) return false;

  const segments = domain.split('.');
  return segments.includes('edu');
}

/**
 * Retorna true se o e-mail pertence a um domínio educativo.
 * Exemplos:
 *   aluno@unisced.edu.mz → true
 *   prof@up.edu.mz       → true
 *   user@gmail.com        → false
 *   user@estudante.com    → false  (edu não é segmento)
 */
export function useEduEmailDetector() {
  return { isEduEmailDomain };
}
