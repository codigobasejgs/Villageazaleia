/**
 * POST /api/email/send
 * Repassa o disparo de e-mail transacional pra Resend API. A apikey nunca sai do servidor.
 *
 * Body esperado: { to: string, subject: string, html: string }
 *
 * ponytail: sem autenticação de app própria neste endpoint (mesmo caso do
 * /api/whatsapp/send). Upgrade quando houver auth de sessão real.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Village Azaleia <portaria@villageazaleia.com.br>';

const EXTERNAL_TIMEOUT_MS = 15000;

export async function POST(request: Request): Promise<Response> {
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ status: 'FAILED', error: 'Resend API não configurada no servidor.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body: { to?: string; subject?: string; html?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ status: 'FAILED', error: 'Body inválido.' }), { status: 400 });
  }

  const { to, subject, html } = body;
  if (!to || !subject || !html) {
    return new Response(JSON.stringify({ status: 'FAILED', error: 'to, subject e html são obrigatórios.' }), { status: 400 });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({ from: RESEND_FROM_EMAIL, to: [to], subject, html }),
      signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS)
    });

    if (response.ok) {
      return new Response(JSON.stringify({ status: 'SENT' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const errorText = await response.text();
    return new Response(JSON.stringify({ status: 'FAILED', error: `Resend API ${response.status}: ${errorText.slice(0, 300)}` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'FAILED', error: err?.message || 'Erro de rede ao enviar e-mail.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
