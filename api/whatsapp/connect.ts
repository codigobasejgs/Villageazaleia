/**
 * POST /api/whatsapp/connect
 * Cria (se ainda não existir) a instância dedicada "village-azaleia" na Evolution API
 * e retorna o QR Code (base64) para o Síndico escanear com o celular do condomínio.
 * Idempotente: pode ser chamada várias vezes sem duplicar a instância.
 *
 * IMPORTANTE: só cria/conecta a instância fixa em EVOLUTION_INSTANCE (village-azaleia).
 * Nunca toca nas instâncias "codigobase" ou "tubarao" (outro projeto do usuário, mesmo servidor).
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'village-azaleia';

/** Procura recursivamente por um campo de imagem base64 (QR Code) na resposta da Evolution API,
 * já que o formato exato do payload varia um pouco entre versões do Evolution API. */
function findBase64QrCode(obj: any, depth = 0): string | null {
  if (!obj || depth > 4) return null;
  if (typeof obj === 'string' && obj.startsWith('data:image')) return obj;
  if (typeof obj !== 'object') return null;

  for (const key of ['base64', 'qrcode', 'code']) {
    const val = obj[key];
    if (typeof val === 'string' && (val.startsWith('data:image') || val.length > 100)) {
      return val.startsWith('data:image') ? val : `data:image/png;base64,${val}`;
    }
    if (val && typeof val === 'object') {
      const nested = findBase64QrCode(val, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return new Response(JSON.stringify({ status: 'error', error: 'Evolution API não configurada no servidor.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const baseUrl = EVOLUTION_API_URL.replace(/\/$/, '');
  const headers = { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' };

  try {
    // 1. Verifica se a instância village-azaleia já existe (filtrando só por esse nome)
    const fetchRes = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${EVOLUTION_INSTANCE}`, { headers });
    let exists = false;
    if (fetchRes.ok) {
      const list: any = await fetchRes.json();
      exists = Array.isArray(list) && list.some((i: any) => i.name === EVOLUTION_INSTANCE);
    }

    // 2. Se não existir, cria a instância
    if (!exists) {
      const createRes = await fetch(`${baseUrl}/instance/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          instanceName: EVOLUTION_INSTANCE,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        })
      });

      if (createRes.ok) {
        const createData = await createRes.json();
        const qrFromCreate = findBase64QrCode(createData);
        if (qrFromCreate) {
          return new Response(JSON.stringify({ status: 'ok', qrCodeBase64: qrFromCreate, alreadyConnected: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // 3. Instância já existe (ou acabou de ser criada sem QR na resposta) — pede o QR de conexão
    const connectRes = await fetch(`${baseUrl}/instance/connect/${EVOLUTION_INSTANCE}`, { headers });
    if (!connectRes.ok) {
      return new Response(JSON.stringify({ status: 'error', error: `Evolution API retornou ${connectRes.status} ao conectar.` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const connectData = await connectRes.json();
    const qrCodeBase64 = findBase64QrCode(connectData);

    if (!qrCodeBase64) {
      // Pode significar que já está conectado (sem necessidade de QR novo)
      return new Response(JSON.stringify({ status: 'ok', qrCodeBase64: null, alreadyConnected: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ status: 'ok', qrCodeBase64, alreadyConnected: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: 'error', error: err?.message || 'Erro ao conectar instância' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
