/**
 * POST /api/whatsapp/connect
 * Cria (se ainda não existir) a instância dedicada "village-azaleia" na Evolution API
 * e retorna o QR Code (base64) para o Síndico escanear com o celular do condomínio.
 * Idempotente: pode ser chamada várias vezes sem duplicar a instância.
 *
 * IMPORTANTE: só cria/conecta a instância fixa em EVOLUTION_INSTANCE (village-azaleia).
 * Nunca toca nas instâncias "codigobase" ou "tubarao" (outro projeto do usuário, mesmo servidor).
 */

// Extensão .js obrigatória para runtime ESM na Vercel
import { authenticateRequest, unauthorizedResponse, forbiddenResponse } from '../_lib/auth.js';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'village-azaleia';

// Timeout de segurança: uma instância travada num estado limbo (ex: "connecting" órfão)
// pode fazer a Evolution API nunca responder. Sem isso, a função serverless fica pendurada
// até o limite do Vercel e o usuário só vê "carregando" pra sempre, sem erro nenhum.
const EXTERNAL_TIMEOUT_MS = 15000;
function timeoutSignal() {
  return AbortSignal.timeout(EXTERNAL_TIMEOUT_MS);
}

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

// Named HTTP method export (formato exigido pelo Vercel pra respostas Web-standard).
// Com `export default`, o Vercel trata como a assinatura antiga (req, res) e IGNORA o
// Response retornado — a requisição fica pendurada até dar 504.
export async function POST(request: Request): Promise<Response> {
  // Apenas Síndico pode criar/conectar a instância do WhatsApp do condomínio.
  // Antes estava desprotegido — qualquer pessoa podia invocar via POST direto na internet.
  const auth = await authenticateRequest(request);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== 'sindico') {
    return forbiddenResponse('Apenas o síndico pode gerenciar a conexão do WhatsApp.');
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
    const fetchRes = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${EVOLUTION_INSTANCE}`, {
      headers,
      signal: timeoutSignal()
    });
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
        }),
        signal: timeoutSignal()
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
    const connectRes = await fetch(`${baseUrl}/instance/connect/${EVOLUTION_INSTANCE}`, { headers, signal: timeoutSignal() });
    if (!connectRes.ok) {
      return new Response(JSON.stringify({ status: 'error', error: `Evolution API retornou ${connectRes.status} ao conectar.` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const connectData = await connectRes.json();
    const qrCodeBase64 = findBase64QrCode(connectData);

    if (!qrCodeBase64) {
      // Pode significar que já está conectado (sem necessidade de QR novo) — mas também pode
      // ser um formato de resposta inesperado da Evolution API. Manda os dados crus junto pra
      // dar pra diagnosticar sem precisar reproduzir às cegas.
      return new Response(
        JSON.stringify({ status: 'ok', qrCodeBase64: null, alreadyConnected: true, debugRawResponse: connectData }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ status: 'ok', qrCodeBase64, alreadyConnected: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return new Response(
      JSON.stringify({
        status: 'error',
        error: isTimeout
          ? 'A Evolution API demorou demais pra responder. A instância pode estar num estado travado — tente novamente em alguns segundos.'
          : err?.message || 'Erro ao conectar instância'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
