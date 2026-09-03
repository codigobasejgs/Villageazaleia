/**
 * Replica exatamente a chamada de api/ocr/analyze-label.ts, usando uma imagem
 * real de etiqueta, pra validar a extracao do Gemini fora do navegador.
 * Uso: node scripts/test-ocr-real-label.cjs <caminho-da-imagem>
 */
const fs = require('fs');
const path = require('path');
const { GoogleGenAI, Type } = require('@google/genai');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const GEMINI_API_KEY = env.match(/^GEMINI_API_KEY="?([^"\n]+)"?/m)[1];

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    carrier: {
      type: Type.STRING,
      enum: ['Mercado Livre', 'Amazon', 'Correios', 'Shopee', 'Loggi', 'Outra'],
      description: 'Transportadora identificada na etiqueta, normalizada para uma destas opções exatas.'
    },
    trackingCode: { type: Type.STRING, nullable: true, description: 'Código de rastreio / número do pedido impresso na etiqueta, se legível.' },
    recipientName: { type: Type.STRING, nullable: true, description: 'Nome completo do destinatário impresso na etiqueta, se legível.' },
    block: {
      type: Type.STRING,
      nullable: true,
      description: 'Identificador do bloco/prédio do condomínio, se impresso na etiqueta. Pode ser só número ("3") ou alfanumérico ("12B") — copie exatamente como está impresso, sem adicionar nem remover letras.'
    },
    apartment: { type: Type.NUMBER, nullable: true, description: 'Número do apartamento, se impresso na etiqueta.' },
    rawText: { type: Type.STRING, description: 'Todo o texto legível encontrado na etiqueta, em uma única string.' },
    confidence: { type: Type.NUMBER, description: 'Confiança geral da extração de 0 a 100.' }
  },
  required: ['carrier', 'rawText', 'confidence']
};

// Mantido em sincronia manual com api/ocr/analyze-label.ts (prompt/model/config) —
// esse script chama o Gemini fora do navegador/Vercel pra depurar uma foto real.
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

(async () => {
  const imgPath = process.argv[2];
  if (!imgPath || !fs.existsSync(imgPath)) {
    console.error('Uso: node scripts/test-ocr-real-label.cjs <caminho-da-imagem>');
    process.exit(1);
  }

  const buf = fs.readFileSync(imgPath);
  const ext = path.extname(imgPath).toLowerCase();
  const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
  const rawBase64 = buf.toString('base64');

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: [{ role: 'user', parts: [{ text: PROMPT }, { inlineData: { mimeType, data: rawBase64 } }] }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
      thinkingConfig: { thinkingBudget: -1 },
      maxOutputTokens: 8192
    }
  });

  console.log(JSON.stringify(JSON.parse(response.text), null, 2));
})();
