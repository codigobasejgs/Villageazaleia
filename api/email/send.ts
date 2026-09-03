/**
 * POST /api/email/send
 * Dispara e-mail transacional via Resend.
 *
 * PROTECAO: exige autenticacao de staff (portaria, sindico ou totem).
 * Fecha o vetor de phishing aberto do BUG-006.
 */

// Extensão .js obrigatória: as funções rodam como ESM no Node da Vercel, onde import
// relativo sem extensão quebra em runtime (ERR_MODULE_NOT_FOUND) mesmo compilando de .ts.
import { authenticateRequest, unauthorizedResponse, forbiddenResponse } from '../_lib/auth.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Village Azaleia <portaria@villageazaleia.com.br>';

const EXTERNAL_TIMEOUT_MS = 15000;

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth) return unauthorizedResponse();

  if (!['portaria', 'sindico', 'totem'].includes(auth.role)) {
    return forbiddenResponse('Apenas a equipe do condominio pode disparar e-mails transacionais.');
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ status: 'FAILED', error: 'Resend API nao configurada no servidor.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body: { to?: string; subject?: string; html?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ status: 'FAILED', error: 'Body JSON invalido.' }), { status: 400 });
  }

  const { to, subject, html } = body;
  if (!to || !subject || !html) {
    return new Response(JSON.stringify({ status: 'FAILED', error: 'to, subject e html sao obrigatorios.' }), { status: 400 });
  }

  // Validacao basica de destinatario
  if (!to.includes('@') || to.endsWith('@villageazaleia.com.br') && to.startsWith('morador@')) {
    // Bloqueia o catch-all falso da auditoria (BUG-012)
    return new Response(JSON.stringify({ status: 'FAILED', error: 'Destinatario nao cadastrado (placeholder).' }), { status: 400 });
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
    return new Response(JSON.stringify({ status: 'FAILED', error: `Resend API ${response.status}: ${errorText.slice(0, 200)}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'FAILED', error: err?.message || 'Erro de rede ao enviar e-mail.' }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
