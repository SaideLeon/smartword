// VPN / Proxy detection service for Next.js (server & client compatible)

export interface IpInfoResponse {
  ip: string;
  hostname?: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string;
  org?: string;
  postal?: string;
  timezone?: string;
}

export interface VpnDetectResult {
  ip: string;
  isVpn: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  geo: {
    city: string | null;
    region: string | null;
    country: string | null;
    timezone: string | null;
    coordinates: { lat: number; lng: number } | null;
  };
  network: {
    org: string | null;
    hostname: string | null;
    asn: string | null;
    isp: string | null;
  };
  raw: IpInfoResponse;
}

export interface VpnDetectOptions {
  ipinfoToken?: string;
  extraKeywords?: string[];
  timeoutMs?: number;
}

const VPN_KEYWORDS = [
  'vpn', 'proxy', 'tor', 'anonymizer', 'anonymous',
  'datacenter', 'data center', 'hosting', 'colocation', 'colo',
  'digitalocean', 'linode', 'akamai', 'vultr', 'ovh', 'hetzner',
  'amazon', 'amazonaws', 'aws', 'google cloud', 'googlecloud',
  'microsoft azure', 'azure', 'cloudflare',
  'nordvpn', 'expressvpn', 'surfshark', 'mullvad', 'ipvanish',
  'privatevpn', 'purevpn', 'cyberghost', 'hidemyass', 'protonvpn',
  'tunnelbear', 'windscribe', 'astrill', 'vyprvpn', 'strongvpn',
  'm247', 'leaseweb', 'quadranet', 'psychz', 'serverius',
  'choopa', 'globo', 'incapsula', 'zscaler',
] as const;

const HIGH_CONFIDENCE_KEYWORDS = [
  'vpn', 'proxy', 'tor', 'anonymizer', 'anonymous',
  'nordvpn', 'expressvpn', 'surfshark', 'mullvad', 'ipvanish',
  'privatevpn', 'purevpn', 'cyberghost', 'hidemyass', 'protonvpn',
  'tunnelbear', 'windscribe', 'astrill', 'vyprvpn', 'strongvpn',
] as const;

function parseAsn(org: string | undefined): { asn: string | null; isp: string | null } {
  if (!org) return { asn: null, isp: null };
  const match = org.match(/^(AS\d+)\s+(.+)$/i);
  if (match) return { asn: match[1], isp: match[2] };
  return { asn: null, isp: org };
}

function parseCoordinates(loc: string | undefined): { lat: number; lng: number } | null {
  if (!loc) return null;
  const [lat, lng] = loc.split(',').map(Number);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

function detectVpnSignals(
  data: IpInfoResponse,
  extraKeywords: string[] = [],
): { isVpn: boolean; confidence: VpnDetectResult['confidence']; reasons: string[] } {
  const reasons: string[] = [];
  const normalizedExtra = extraKeywords.map((k) => k.toLowerCase());
  const allKeywords = [...VPN_KEYWORDS, ...normalizedExtra];
  const highKw = [...HIGH_CONFIDENCE_KEYWORDS, ...normalizedExtra];

  const fieldsToCheck: Array<{ label: string; value: string | undefined }> = [
    { label: 'org', value: data.org },
    { label: 'hostname', value: data.hostname },
  ];

  let highConfidenceHit = false;
  let mediumConfidenceHit = false;

  for (const { label, value } of fieldsToCheck) {
    if (!value) continue;
    const lower = value.toLowerCase();

    for (const kw of allKeywords) {
      if (lower.includes(kw)) {
        reasons.push(`${label} contém "${kw}" (valor: "${value}")`);
        if (highKw.includes(kw as never)) {
          highConfidenceHit = true;
        } else {
          mediumConfidenceHit = true;
        }
        break;
      }
    }
  }

  const isVpn = reasons.length > 0;
  let confidence: VpnDetectResult['confidence'] = 'low';
  if (highConfidenceHit) confidence = 'high';
  else if (mediumConfidenceHit) confidence = 'medium';

  return { isVpn, confidence, reasons };
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const VpnDetectService = {
  async getPublicIp(timeoutMs = 5000): Promise<string> {
    const res = await fetchWithTimeout('https://api.ipify.org?format=json', timeoutMs);
    if (!res.ok) throw new Error(`ipify responded with ${res.status}`);
    const { ip } = (await res.json()) as { ip: string };
    return ip;
  },

  async getIpInfo(ip: string, options: VpnDetectOptions = {}): Promise<IpInfoResponse> {
    const { ipinfoToken, timeoutMs = 5000 } = options;
    const url = ipinfoToken
      ? `https://ipinfo.io/${ip}/json?token=${ipinfoToken}`
      : `https://ipinfo.io/${ip}/json`;

    const res = await fetchWithTimeout(url, timeoutMs);
    if (!res.ok) throw new Error(`ipinfo.io responded with ${res.status}`);
    return res.json() as Promise<IpInfoResponse>;
  },

  async detect(ip?: string, options: VpnDetectOptions = {}): Promise<VpnDetectResult> {
    const { extraKeywords = [], timeoutMs = 5000 } = options;
    const resolvedIp = ip ?? (await this.getPublicIp(timeoutMs));
    const data = await this.getIpInfo(resolvedIp, options);
    const { asn, isp } = parseAsn(data.org);
    const { isVpn, confidence, reasons } = detectVpnSignals(data, extraKeywords);

    return {
      ip: resolvedIp,
      isVpn,
      confidence,
      reasons,
      geo: {
        city: data.city ?? null,
        region: data.region ?? null,
        country: data.country ?? null,
        timezone: data.timezone ?? null,
        coordinates: parseCoordinates(data.loc),
      },
      network: {
        org: data.org ?? null,
        hostname: data.hostname ?? null,
        asn,
        isp,
      },
      raw: data,
    };
  },
} as const;

export function getClientIpFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined>,
): string | null {
  const get = (key: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(key);
    }
    const val = headers[key];
    if (!val) return null;
    return Array.isArray(val) ? val[0] : val;
  };

  const raw =
    get('x-vercel-forwarded-for') ??
    get('cf-connecting-ip') ??
    get('x-real-ip') ??
    get('x-forwarded-for');

  if (!raw) return null;
  return raw.split(',')[0].trim() || null;
}
