import type { CoverData } from '@/lib/docx/cover-types';

const MAX_COVER_DATA_BYTES = 50_000;
const MAX_MEMBERS = 20;
const MAX_MEMBER_LENGTH = 120;
const MAX_LOGO_BASE64 = 45_000;

const STRING_LIMITS = {
  institution: 200,
  delegation: 120,
  course: 200,
  subject: 300,
  theme: 400,
  group: 120,
  teacher: 200,
  city: 100,
  date: 80,
  abstract: 5000,
} as const;

const ALLOWED_KEYS = new Set([
  'institution',
  'delegation',
  'logoBase64',
  'logoMediaType',
  'course',
  'subject',
  'theme',
  'group',
  'members',
  'teacher',
  'city',
  'date',
  'abstract',
]);

function parseBoundedString(value: unknown, maxLength: number, required = false): string | undefined {
  if (value == null) {
    if (required) return undefined;
    return undefined;
  }

  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return required ? undefined : undefined;
  if (normalized.length > maxLength) return undefined;
  return normalized;
}

export function parseCoverDataPayload(raw: unknown): CoverData | null {
  if (raw === null) return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const serialized = JSON.stringify(raw);
  if (!serialized || serialized.length > MAX_COVER_DATA_BYTES) return null;

  const payload = raw as Record<string, unknown>;

  for (const key of Object.keys(payload)) {
    if (!ALLOWED_KEYS.has(key)) return null;
  }

  const institution = parseBoundedString(payload.institution, STRING_LIMITS.institution, true);
  const course = parseBoundedString(payload.course, STRING_LIMITS.course, true);
  const subject = parseBoundedString(payload.subject, STRING_LIMITS.subject, true);
  const theme = parseBoundedString(payload.theme, STRING_LIMITS.theme, true);
  const teacher = parseBoundedString(payload.teacher, STRING_LIMITS.teacher, true);
  const city = parseBoundedString(payload.city, STRING_LIMITS.city, true);
  const date = parseBoundedString(payload.date, STRING_LIMITS.date, true);

  if (!institution || !course || !subject || !theme || !teacher || !city || !date) {
    return null;
  }

  if (!Array.isArray(payload.members) || payload.members.length === 0 || payload.members.length > MAX_MEMBERS) {
    return null;
  }

  const members = payload.members
    .map(member => (typeof member === 'string' ? member.trim() : null))
    .filter((member): member is string => typeof member === 'string' && member.length > 0 && member.length <= MAX_MEMBER_LENGTH);

  if (members.length !== payload.members.length) return null;

  const result: CoverData = {
    institution,
    course,
    subject,
    theme,
    members,
    teacher,
    city,
    date,
  };

  const delegation = parseBoundedString(payload.delegation, STRING_LIMITS.delegation);
  if (delegation) result.delegation = delegation;

  const group = parseBoundedString(payload.group, STRING_LIMITS.group);
  if (group) result.group = group;

  const abstract = parseBoundedString(payload.abstract, STRING_LIMITS.abstract);
  if (abstract) result.abstract = abstract;

  if (payload.logoBase64 != null || payload.logoMediaType != null) {
    if (typeof payload.logoBase64 !== 'string' || payload.logoBase64.length > MAX_LOGO_BASE64) return null;
    if (payload.logoMediaType !== 'image/png' && payload.logoMediaType !== 'image/jpeg') return null;
    result.logoBase64 = payload.logoBase64;
    result.logoMediaType = payload.logoMediaType;
  }

  return result;
}
