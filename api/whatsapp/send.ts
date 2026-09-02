/**
 * POST /api/whatsapp/send
 * Dispara WhatsApp transacional via Evolution API (instancia "village-azaleia").
 *
 * PROTECAO: exige autenticacao de staff (portaria, sindico ou totem).
 * Qualquer chamada sem token valido e recusada com 401/403 (fecha o gateway aberto — BUG-006).
 */

import { authenticateRequest, unauthorizedResponse, forbiddenResponse } from '../_lib/auth';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'village-azaleia';

const EXTERNAL_TIMEOUT_MS = 15000;

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth) return unauthorizedResponse();

  // So equipe da portaria, sindico ou totem podem acionar notificacoes
  if (!['portaria', 'sindico', 'totem'].includes(auth.role)) {
    return forbiddenResponse('Apenas a equipe do condominio pode disparar notificacoes.');
  }

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return new Response(JSON.stringify({ status: 'FAILED', error: 'Evolution API nao configurada no servidor.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body: { phone?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ status: 'FAILED', error: 'Body JSON invalido.' }), { status: 400 });
  }

  const { phone, text } = body;
  if (!phone || !text) {
    return new Response(JSON.stringify({ status: 'FAILED', error: 'phone e text sao obrigatorios.' }), { status: 400 });
  }

  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 10 || cleanPhone.length > 13) {
    return new Response(JSON.stringify({ status: 'FAILED', error: 'Numero de telefone invalido.' }), { status: 400 });
  }

  // Bloqueia o numero placeholder da auditoria (BUG-012)
  if (cleanPhone.includes('999990000') || cleanPhone.endsWith('00000000')) {
    return new Response(JSON.stringify({ status: 'FAILED', error: 'Telefone nao preenchido (placeholder).' }), { status: 400 });
  }

  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  try {
    const endpoint = `${EVOLUTION_API_URL.replace(/\/$/, '')}/message/sendText/${EVOLUTION_INSTANCE}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: formattedPhone,
        text,
        options: { delay: 1200, presence: 'composing', linkPreview: false }
      }),
      signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS)
    });

    if (response.ok) {
      return new Response(JSON.stringify({ status: 'SENT' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const errorText = await response.text();
    return new Response(JSON.stringify({ status: 'FAILED', error: `Evolution API ${response.status}: ${errorText.slice(0, 200)}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'FAILED', error: err?.message || 'Erro de rede ao enviar WhatsApp.' }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
