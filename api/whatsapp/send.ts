/**
 * POST /api/whatsapp/send
 * Repassa o envio de uma mensagem de texto já formatada pra Evolution API,
 * usando a instância dedicada "village-azaleia". A apikey nunca sai do servidor.
 *
 * Body esperado: { phone: string, text: string }
 *
 * ponytail: sem autenticação de app própria neste endpoint (o projeto ainda não tem
 * um sistema de auth de usuário pra proteger rotas de escrita). Upgrade quando houver:
 * validar a sessão do chamador (Portaria/Totem/Síndico) antes de disparar a mensagem.
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'village-azaleia';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'FAILED', error: 'Method not allowed' }), { status: 405 });
  }

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return new Response(JSON.stringify({ status: 'FAILED', error: 'Evolution API não configurada no servidor.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body: { phone?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ status: 'FAILED', error: 'Body inválido.' }), { status: 400 });
  }

  const { phone, text } = body;
  if (!phone || !text) {
    return new Response(JSON.stringify({ status: 'FAILED', error: 'phone e text são obrigatórios.' }), { status: 400 });
  }

  const cleanPhone = phone.replace(/\D/g, '');
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
        options: { delay: 1200, presence: 'composing', linkPreview: true }
      })
    });

    if (response.ok) {
      return new Response(JSON.stringify({ status: 'SENT' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const errorText = await response.text();
    return new Response(JSON.stringify({ status: 'FAILED', error: `Evolution API ${response.status}: ${errorText.slice(0, 300)}` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'FAILED', error: err?.message || 'Erro de rede ao enviar mensagem.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
