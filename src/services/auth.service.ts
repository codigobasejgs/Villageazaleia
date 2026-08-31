import { AuthSession, StaffAccount, Unit } from '../types';

const SESSION_KEY = 'village_azaleia_session';
// ponytail: salt fixo e hash client-side são apenas um placeholder honesto até o
// backend Supabase existir (bcrypt/argon2 no servidor). Trocar só este arquivo.
const DEMO_SALT = 'village-azaleia-2026';

/**
 * Hash de senha via Web Crypto (SubtleCrypto) — API nativa do browser,
 * disponível em contexto seguro (localhost e HTTPS). Sem dependência nova.
 */
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${DEMO_SALT}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (await hashPassword(password)) === hash;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function loginMorador(email: string, password: string, units: Unit[]): Promise<Unit | null> {
  const unit = units.find((u) => normalizeEmail(u.residentEmail) === normalizeEmail(email));
  if (!unit || !unit.passwordHash) return null;
  const ok = await verifyPassword(password, unit.passwordHash);
  return ok ? unit : null;
}

export async function loginStaff(
  email: string,
  password: string,
  staff: StaffAccount[]
): Promise<StaffAccount | null> {
  const account = staff.find((s) => normalizeEmail(s.email) === normalizeEmail(email));
  if (!account) return null;
  const ok = await verifyPassword(password, account.passwordHash);
  return ok ? account : null;
}

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function setSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
