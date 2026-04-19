'use client';

// src/hooks/useAuth.ts
// Autenticação Supabase: Google OAuth + Email/Senha
// Expõe: user, profile, plan, loading, signInGoogle, signInEmail, signUp, signOut

import { createBrowserClient } from '@supabase/ssr';
import { useCallback, useEffect, useState } from 'react';

// ── Cliente Supabase (singleton no browser) ────────────────────────────────
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

export const supabaseClient = createBrowserClient(supabaseUrl, supabaseAnon);

// ── Tipos ──────────────────────────────────────────────────────────────────
export interface UserProfile {
  id:                  string;
  email:               string | null;
  full_name:           string | null;
  avatar_url:          string | null;
  role:                'user' | 'admin';
  plan_key:            string;
  plan_expires_at:     string | null;
  payment_status:      'none' | 'pending' | 'active' | 'expired' | 'cancelled';
  works_used:          number;
  edits_used:          number;
}

export interface PlanInfo {
  key:             string;
  label:           string;
  price_mzn:       number;
  works_limit:     number | null;
  tcc_enabled:     boolean;
  ai_chat_enabled: boolean;
  cover_enabled:   boolean;
  export_full:     boolean;
  edits_limit:     number | null;
  duration_months: number;
}

// ── Hook principal ─────────────────────────────────────────────────────────
export function useAuth() {
  const [user, setUser]       = useState<import('@supabase/supabase-js').User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan]       = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Carrega perfil e plano do utilizador
  const loadProfile = useCallback(async (userId: string) => {
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profileData) return;
    setProfile(profileData as UserProfile);

    // Carrega dados do plano
    const { data: planData } = await supabaseClient
      .from('plans')
      .select('*')
      .eq('key', profileData.plan_key)
      .single();

    if (planData) setPlan(planData as PlanInfo);
  }, []);

  // Inicialização e listener de sessão
  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setPlan(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // ── Login com Google ─────────────────────────────────────────────────────
  const signInGoogle = useCallback(async () => {
    setError(null);
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${(appUrl ?? window.location.origin).replace(/\/$/, '')}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) setError(error.message);
  }, []);

  // ── Login com Email/Senha ────────────────────────────────────────────────
  const signInEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    return !error;
  }, []);

  // ── Registo com Email/Senha ──────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    setError(null);
    const normalizedFullName = fullName?.trim() || email.split('@')[0];

    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { full_name: normalizedFullName } },
    });
    if (error) setError(error.message);
    return !error;
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabaseClient.auth.signOut();
    setProfile(null);
    setPlan(null);
  }, []);

  // ── Verificação de funcionalidades ───────────────────────────────────────
  const canUse = useCallback((feature: 'export_full' | 'tcc' | 'ai_chat' | 'cover' | 'create_work') => {
    if (!plan || !profile) return false;

    // Plano expirado → limites do free
    const expired = plan.duration_months > 0 &&
      profile.plan_expires_at &&
      new Date(profile.plan_expires_at) < new Date();

    if (expired) {
      return feature === 'create_work' && profile.works_used < 20;
    }

    switch (feature) {
      case 'create_work':
        return plan.works_limit === null || profile.works_used < plan.works_limit;
      case 'export_full':  return plan.export_full;
      case 'tcc':          return plan.tcc_enabled;
      case 'ai_chat':      return plan.ai_chat_enabled;
      case 'cover':        return plan.cover_enabled;
      default: return false;
    }
  }, [plan, profile]);

  // Determina se a exportação deve ser cortada ao meio
  const shouldTruncateExport = !canUse('export_full');

  return {
    user,
    profile,
    plan,
    loading,
    error,
    isAdmin:   profile?.role === 'admin',
    isLoggedIn: !!user,
    signInGoogle,
    signInEmail,
    signUp,
    signOut,
    canUse,
    shouldTruncateExport,
    refreshProfile: () => user ? loadProfile(user.id) : Promise.resolve(),
  };
}
