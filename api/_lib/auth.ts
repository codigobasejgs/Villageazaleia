/**
 * Helper de autenticacao e autorizacao para funcoes serverless em api/*.
 *
 * Valida o JWT do Supabase que vem no cabecalho Authorization e consulta o
 * perfil do usuario na tabela `profiles`. Sem token valido = requisicao negada.
 */

export interface AuthContext {
  userId: string;
  role: 'portaria' | 'sindico' | 'morador' | 'totem';
  name: string;
  unitId?: string | null;
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function authenticateRequest(request: Request): Promise<AuthContext | null> {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token || !SUPABASE_URL || !SERVICE_ROLE_KEY) return null;

  try {
    // Valida o JWT contra o endpoint nativo do Supabase Auth
    const userRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${token}`
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!userRes.ok) return null;
    const userData = await userRes.json();
    if (!userData?.id) return null;

    // Busca o papel na tabela profiles (usando service_role pra enxergar)
    const profileRes = await fetch(
      `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${userData.id}&select=id,role,name,unit_id&limit=1`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`
        },
        signal: AbortSignal.timeout(8000)
      }
    );

    if (!profileRes.ok) return null;
    const profiles = await profileRes.json();
    if (!Array.isArray(profiles) || profiles.length === 0) return null;

    const p = profiles[0];
    return {
      userId: userData.id,
      role: p.role,
      name: p.name,
      unitId: p.unit_id
    };
  } catch {
    return null;
  }
}

export function unauthorizedResponse(motivo = 'Acesso nao autorizado. Faca login novamente.'): Response {
  return new Response(JSON.stringify({ status: 'UNAUTHORIZED', error: motivo }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function forbiddenResponse(motivo = 'Sem permissao para executar esta acao.'): Response {
  return new Response(JSON.stringify({ status: 'FORBIDDEN', error: motivo }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' }
  });
}
