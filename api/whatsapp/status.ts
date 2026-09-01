/**
 * GET /api/whatsapp/status
 * Consulta o estado de conexão da instância dedicada "village-azaleia" na Evolution API.
 * Roda só no servidor (Vercel serverless) — a apikey nunca chega ao navegador.
 *
 * IMPORTANTE: esta função só enxerga/consulta a instância fixa em EVOLUTION_INSTANCE
 * (village-azaleia). Nunca lista, cria ou altera outras instâncias do mesmo servidor
 * Evolution (ex: "codigobase", "tubarao" — pertencem a outro projeto do usuário).
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'village-azaleia';

// Evita a função ficar pendurada se a Evolution API não responder (ex: instância num estado limbo)
const EXTERNAL_TIMEOUT_MS = 15000;
function timeoutSignal() {
  return AbortSignal.timeout(EXTERNAL_TIMEOUT_MS);
}

// Named HTTP method export (formato exigido pelo Vercel pra respostas Web-standard).
// Com `export default`, o Vercel trata como a assinatura antiga (req, res) e IGNORA o
// Response retornado — a requisição fica pendurada até dar 504.
export async function GET(): Promise<Response> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return new Response(
      JSON.stringify({ connected: false, exists: false, error: 'Evolution API não configurada no servidor.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const stateRes = await fetch(
      `${EVOLUTION_API_URL.replace(/\/$/, '')}/instance/connectionState/${EVOLUTION_INSTANCE}`,
      { headers: { apikey: EVOLUTION_API_KEY }, signal: timeoutSignal() }
    );

    if (stateRes.status === 404) {
      return new Response(JSON.stringify({ connected: false, exists: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!stateRes.ok) {
      return new Response(JSON.stringify({ connected: false, exists: true, error: `Evolution API retornou ${stateRes.status}` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const stateData: any = await stateRes.json();
    const state: string | undefined = stateData?.instance?.state || stateData?.state;
    const connected = state === 'open';

    let profileName: string | undefined;
    let number: string | undefined;

    if (connected) {
      try {
        const fetchRes = await fetch(
          `${EVOLUTION_API_URL.replace(/\/$/, '')}/instance/fetchInstances?instanceName=${EVOLUTION_INSTANCE}`,
          { headers: { apikey: EVOLUTION_API_KEY }, signal: timeoutSignal() }
        );
        if (fetchRes.ok) {
          const list: any = await fetchRes.json();
          const info = Array.isArray(list) ? list.find((i: any) => i.name === EVOLUTION_INSTANCE) : null;
          profileName = info?.profileName;
          number = info?.ownerJid ? String(info.ownerJid).split('@')[0] : undefined;
        }
      } catch {
        // Non-critical — status ainda é reportado sem os detalhes de perfil
      }
    }

    return new Response(JSON.stringify({ connected, exists: true, profileName, number }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ connected: false, exists: false, error: err?.message || 'Erro ao consultar status' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
