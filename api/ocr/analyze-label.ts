/**
 * POST /api/ocr/analyze-label
 * Recebe a foto real da etiqueta (capturada pela câmera na Portaria/Totem) e usa o
 * Gemini Vision pra extrair transportadora, código de rastreio, destinatário e bloco/apto
 * visíveis na etiqueta. Roda só no servidor — a chave Gemini nunca chega ao navegador.
 *
 * Body esperado: { imageBase64: string } (data URL completa, ex: "data:image/jpeg;base64,...")
 */

import { GoogleGenAI, Type } from '@google/genai';

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
      type: Type.NUMBER,
      nullable: true,
      description: 'Número do bloco/prédio do condomínio, se impresso na etiqueta (só dígitos).'
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

const PROMPT = `Você é um especialista em leitura de etiquetas de encomendas de e-commerce brasileiro (Mercado Livre, Amazon, Correios, Shopee, Loggi).
Analise a foto da etiqueta anexada e extraia com precisão:
- A transportadora (normalize para exatamente uma destas opções: "Mercado Livre", "Amazon", "Correios", "Shopee", "Loggi" ou "Outra").
- O código de rastreio/pedido.
- O nome completo do destinatário.
- O número do bloco e do apartamento do condomínio, SE estiverem impressos (apenas dígitos, sem letras).
- Todo o texto legível da etiqueta em "rawText".
- Uma confiança de 0 a 100 refletindo a nitidez e completude da leitura.
Se algum campo não estiver legível ou não existir na etiqueta, retorne null para ele (exceto carrier, rawText e confidence, que são obrigatórios).`;

// Named HTTP method export (formato exigido pelo Vercel pra respostas Web-standard).
export async function POST(request: Request): Promise<Response> {
  if (!GEMINI_API_KEY) {
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
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: PROMPT }, { inlineData: { mimeType, data: rawBase64 } }]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA
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
    return new Response(JSON.stringify({ error: err?.message || 'Erro ao analisar etiqueta com Gemini.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
