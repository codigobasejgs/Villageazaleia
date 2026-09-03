/**
 * POST /api/totem/session
 * Autentica o Totem (quiosque físico da portaria, sem login pessoal do entregador)
 * trocando as credenciais da conta de serviço "totem" — guardadas só no servidor —
 * por uma sessão real do Supabase Auth. Sem isso, o quiosque não tinha identidade
 * nenhuma e toda escrita era rejeitada pela RLS (BUG descoberto em produção:
 * entregas via Totem nunca eram salvas, mesmo aparentando sucesso na tela).
 *
 * ponytail: este endpoint não exige nenhuma credencial do chamador — é assim de
 * propósito (o entregador não tem conta). Isso significa que quem descobrir esta
 * URL consegue o mesmo escopo do totem (ler units/packages, criar packages) — bem
 * mais restrito que o acesso anônimo total de antes, mas não é zero. Upgrade
 * futuro: allowlist de IP do tablet físico da portaria, ou token de pareamento.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const TOTEM_EMAIL = process.env.TOTEM_EMAIL || '';
const TOTEM_PASSWORD = process.env.TOTEM_PASSWORD || '';

export async function POST(): Promise<Response> {
  if (!SUPABASE_URL || !ANON_KEY || !TOTEM_EMAIL || !TOTEM_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Totem nao configurado no servidor.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const r = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TOTEM_EMAIL, password: TOTEM_PASSWORD }),
      signal: AbortSignal.timeout(10000)
    });

    const data = await r.json();
    if (!r.ok || !data.access_token) {
      return new Response(JSON.stringify({ error: 'Falha ao autenticar o totem.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(
      JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Erro de rede ao autenticar o totem.' }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
