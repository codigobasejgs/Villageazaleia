import { AuthSession, AppRole } from '../types';
import { supabase } from '../lib/supabase';

/**
 * Autenticação real via Supabase Auth.
 *
 * A sessão é o JWT emitido e assinado pelo Supabase — o navegador não decide
 * mais quem é quem. O papel vem da tabela `profiles`, que só o servidor escreve,
 * e é o mesmo papel que as políticas RLS consultam. Adulterar o localStorage
 * agora não muda nada: o banco recusa a query.
 *
 * Substitui o hash SHA-256 client-side anterior (BUG-001/BUG-002 da auditoria).
 */

export interface AuthProfile {
  id: string;
  role: AppRole;
  name: string;
  unitId: string | null;
}

export interface LoginResult {
  ok: boolean;
  profile?: AuthProfile;
  error?: string;
}

function mensagemDeErro(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (m.includes('failed to fetch') || m.includes('networkerror')) return 'Sem conexão com o servidor. Verifique a internet.';
  return 'Não foi possível entrar. Tente novamente.';
}

/** Busca o perfil (papel + unidade) do usuário logado. */
export async function fetchProfile(): Promise<AuthProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, name, unit_id')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    role: data.role as AppRole,
    name: data.name,
    unitId: data.unit_id ?? null
  };
}

async function login(email: string, password: string, papeisAceitos: AppRole[]): Promise<LoginResult> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });

  if (error) return { ok: false, error: mensagemDeErro(error.message) };

  const profile = await fetchProfile();
  if (!profile) {
    await supabase.auth.signOut();
    return { ok: false, error: 'Conta sem perfil configurado. Procure o síndico.' };
  }

  if (!papeisAceitos.includes(profile.role)) {
    await supabase.auth.signOut();
    return { ok: false, error: 'Esta conta não tem acesso a esta área.' };
  }

  return { ok: true, profile };
}

export function loginStaff(email: string, password: string): Promise<LoginResult> {
  return login(email, password, ['portaria', 'sindico']);
}

export function loginMorador(email: string, password: string): Promise<LoginResult> {
  return login(email, password, ['morador']);
}

/**
 * Cadastro de morador. A vinculação à unidade NÃO acontece aqui — quem decide
 * qual unidade pertence a quem é o backend (api/units/claim), que valida se a
 * unidade já tem titular. Isso fecha o sequestro de unidade (BUG-007).
 */
export async function registerMorador(
  email: string,
  password: string,
  name: string
): Promise<LoginResult> {
  const { error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { name: name.trim() } }
  });

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('already registered') || m.includes('already been')) {
      return { ok: false, error: 'Este e-mail já está cadastrado. Use "Entrar".' };
    }
    if (m.includes('password')) {
      return { ok: false, error: 'Senha muito fraca. Use ao menos 8 caracteres.' };
    }
    return { ok: false, error: mensagemDeErro(error.message) };
  }

  const profile = await fetchProfile();
  return { ok: true, profile: profile ?? undefined };
}

/** Sessão derivada do JWT do Supabase — nunca de parâmetro de URL. */
export async function getSession(): Promise<AuthSession | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;

  const profile = await fetchProfile();
  if (!profile) return null;

  if (profile.role === 'morador') {
    return profile.unitId ? { type: 'morador', unitId: profile.unitId } : null;
  }
  return { type: profile.role, staffId: profile.id };
}

export async function clearSession(): Promise<void> {
  await supabase.auth.signOut();
}

/** Avisa quando o Supabase renova ou encerra a sessão (expiração real). */
export function onAuthChange(cb: () => void): () => void {
  const { data } = supabase.auth.onAuthStateChange(() => cb());
  return () => data.subscription.unsubscribe();
}
