/**
 * POST /api/ocr/analyze-label
 * Recebe a foto real da etiqueta (capturada pela câmera na Portaria/Totem) e usa o
 * Gemini Vision pra extrair transportadora, código de rastreio, destinatário e bloco/apto
 * visíveis na etiqueta. Roda só no servidor — a chave Gemini nunca chega ao navegador.
 *
 * Body esperado: { imageBase64: string } (data URL completa, ex: "data:image/jpeg;base64,...")
 */

import { GoogleGenAI, Type } from '@google/genai';
// Extensão .js obrigatória: as funções rodam como ESM no Node da Vercel, onde import
// relativo sem extensão quebra em runtime (ERR_MODULE_NOT_FOUND) mesmo compilando de .ts.
import { authenticateRequest, unauthorizedResponse, forbiddenResponse } from '../_lib/auth.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    carrier: {
      type: Type.STRING,
      enum: ['Mercado Livre', 'Amazon', 'Correios', 'Shopee', 'Loggi', 'Outra'],
      description: 'Transportadora identificada na etiqueta, normalizada para uma destas opções exatas.'
    },
    trackingCode: {
      type: Type.STRING,
      nullable: true,
      description: 'Código de rastreio / número do pedido impresso na etiqueta, se legível.'
    },
    recipientName: {
      type: Type.STRING,
      nullable: true,
      description: 'Nome completo do destinatário impresso na etiqueta, se legível.'
    },
    block: {
      type: Type.STRING,
      nullable: true,
      description: 'Identificador do bloco/prédio do condomínio, se impresso na etiqueta. Pode ser só número ("3") ou alfanumérico ("12B") — copie exatamente como está impresso, sem adicionar nem remover letras.'
    },
    apartment: {
      type: Type.NUMBER,
      nullable: true,
      description: 'Número do apartamento, se impresso na etiqueta.'
    },
    rawText: {
      type: Type.STRING,
      description: 'Todo o texto legível encontrado na etiqueta, em uma única string.'
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Confiança geral da extração de 0 a 100.'
    }
  },
  required: ['carrier', 'rawText', 'confidence']
};

const PROMPT = `Você é um especialista sênior em leitura de etiquetas de encomendas de e-commerce brasileiro (Mercado Livre, Amazon, Correios, Shopee, Loggi), treinado para extrair dados mesmo de fotos imperfeitas — foco, ângulo, iluminação ou enquadramento não ideais são a regra em portaria de condomínio, não a exceção.

Antes de responder, examine a imagem com atenção máxima:
- Textos pequenos, código de rastreio e bloco/apartamento costumam ser a parte mais difícil de ler — dedique atenção extra a eles, inclusive texto próximo às bordas ou parcialmente cortado.
- Se a etiqueta estiver girada, tremida, com reflexo de luz (glare) ou parcialmente fora de foco, ainda assim tente ler o que for possível — não desista no primeiro obstáculo.
- Cuidado com ambiguidades comuns de OCR: "0" (zero) vs "O" (letra), "1" (um) vs "I"/"l", "8" vs "B". Use o contexto (ex: código de rastreio é sempre alfanumérico em padrão fixo por transportadora) para decidir a leitura mais provável.
- Se houver mais de um bloco de texto/código na etiqueta (remetente, destinatário, código de barras, número da nota fiscal), identifique qual é o código de RASTREIO/PEDIDO da entrega (não confunda com CPF, CEP ou número de nota fiscal).
- O endereço de entrega é dentro do Condomínio Residencial Village Azaleia — bloco e apartamento estarão referenciados de alguma forma (ex: "Bloco 3", "Bl 03", "B3", "12B", "Apto 102", "Apt. 304").

Extraia com precisão:
- A transportadora (normalize para exatamente uma destas opções: "Mercado Livre", "Amazon", "Correios", "Shopee", "Loggi" ou "Outra").
- O código de rastreio/pedido.
- O nome completo do destinatário.
- O bloco e o apartamento do condomínio, SE estiverem impressos. O apartamento é sempre numérico. O bloco pode ter letra no final (ex: "12B") — transcreva exatamente como impresso, não arredonde para só números.
- Todo o texto legível da etiqueta em "rawText" (inclua tudo que conseguir ler, mesmo texto secundário — isso permite conferência manual depois).
- Uma confiança de 0 a 100 refletindo a nitidez e completude REAL da leitura (seja honesto: uma leitura parcial ou incerta deve ter confiança baixa, não alta).

Se algum campo não estiver legível ou não existir na etiqueta MESMO após essa análise cuidadosa, retorne null para ele (exceto carrier, rawText e confidence, que são obrigatórios) — não invente ou "chute" um valor plausível.`;

// Named HTTP method export (formato exigido pelo Vercel pra respostas Web-standard).
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth) return unauthorizedResponse();

  if (!['portaria', 'sindico', 'totem'].includes(auth.role)) {
    return forbiddenResponse('Apenas a portaria pode usar o OCR de etiquetas.');
  }

  if (!GEMINI_API_KEY) {
    // Log explícito: sem isso o log da Vercel mostra só "500" sem mensagem, e a causa
    // (variável de ambiente ausente em produção) fica indistinguível de um bug de código.
    // Nunca logar o valor da chave — só o nome da variável que falta.
    console.error('[OCR] GEMINI_API_KEY ausente no ambiente do servidor (configure na Vercel e refaça o deploy).');
    return new Response(JSON.stringify({ error: 'Gemini API não configurada no servidor.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body: { imageBase64?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido.' }), { status: 400 });
  }

  if (!body.imageBase64) {
    return new Response(JSON.stringify({ error: 'imageBase64 é obrigatório.' }), { status: 400 });
  }

  // Separa o mimeType e os dados puros do data URL (ex: "data:image/jpeg;base64,/9j/4AAQ...")
  const match = body.imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
  const mimeType = match?.[1] || 'image/jpeg';
  const rawBase64 = match?.[2] || body.imageBase64;

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      // gemini-3.1-pro-preview (não -flash): visão/OCR sensivelmente mais precisa em
      // etiquetas reais borradas/mal enquadradas — o pedido foi nível máximo de
      // qualidade, não velocidade. Custo/latência maiores são aceitáveis aqui (uso é
      // sob demanda, 1 leitura por encomenda). "gemini-2.5-pro" foi testado e está
      // desativado pra novas chaves de API (404 "no longer available to new users").
      model: 'gemini-3.1-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [{ text: PROMPT }, { inlineData: { mimeType, data: rawBase64 } }]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0, // extração factual — determinístico, sem criatividade
        // Orçamento de "pensamento" dinâmico (-1): deixa o modelo raciocinar o quanto
        // precisar em etiquetas difíceis antes de fechar a resposta estruturada.
        thinkingConfig: { thinkingBudget: -1 },
        maxOutputTokens: 8192
      }
    });

    const text = response.text;
    if (!text) {
      return new Response(JSON.stringify({ error: 'Gemini não retornou conteúdo.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const parsed = JSON.parse(text);
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    // Idem: erro real do Gemini (modelo inválido, cota, timeout) precisa aparecer no log,
    // senão o cliente só vê "não consegui ler" e a causa some.
    console.error('[OCR] Falha na chamada ao Gemini:', err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || 'Erro ao analisar etiqueta com Gemini.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
