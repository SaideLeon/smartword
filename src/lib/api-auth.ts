import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getClientIpFromHeaders, VpnDetectService } from '@/lib/vpndetect.service';

export type ApiAuthResult =
  | { user: { id: string }; error: null }
  | { user: null; error: NextResponse };

export async function requireAuth(): Promise<ApiAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }),
    };
  }

  return { user: { id: user.id }, error: null };
}

export async function requireFeatureAccess(
  userId: string,
  feature: 'cover' | 'ai_chat' | 'export_full' | 'tcc' | 'create_work',
  request?: Request,
): Promise<NextResponse | null> {
  const supabase = await createClient();
  const clientIp = request ? getClientIpFromHeaders(request.headers) : null;

  let vpnDetected = false;
  if (clientIp) {
    try {
      const vpnResult = await VpnDetectService.detect(clientIp, {
        ipinfoToken: process.env.IPINFO_TOKEN,
        timeoutMs: 3500,
      });
      vpnDetected = vpnResult.isVpn;
    } catch {
      vpnDetected = false;
    }
  }

  const { data: welcomeData } = await supabase.rpc('evaluate_welcome_access', {
    p_user_id: userId,
    p_client_ip: clientIp,
    p_vpn_detected: vpnDetected,
  });

  const welcomeEligible = !!(welcomeData && typeof welcomeData === 'object' && (welcomeData as { eligible?: boolean }).eligible);
  const welcomeReason = welcomeData && typeof welcomeData === 'object'
    ? String((welcomeData as { reason?: string }).reason ?? '')
    : '';

  if (welcomeEligible) {
    return null;
  }

  const { data: hasAccess, error } = await supabase.rpc('check_user_access', {
    p_user_id: userId,
    p_feature: feature,
  });

  if (error || !hasAccess) {
    if (welcomeReason === 'VPN_DETECTED') {
      return NextResponse.json(
        { error: 'VPN detectada. Desliga a VPN para receber os 5 dias grátis de acesso ilimitado.' },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: 'Plano insuficiente para esta funcionalidade.' },
      { status: 403 },
    );
  }

  return null;
}
