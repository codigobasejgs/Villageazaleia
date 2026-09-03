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

const PROMPT = `Você é um especialista em leitura de etiquetas de encomendas de e-commerce brasileiro (Mercado Livre, Amazon, Correios, Shopee, Loggi).
Analise a foto da etiqueta anexada e extraia com precisão:
- A transportadora (normalize para exatamente uma destas opções: "Mercado Livre", "Amazon", "Correios", "Shopee", "Loggi" ou "Outra").
- O código de rastreio/pedido.
- O nome completo do destinatário.
- O bloco e o apartamento do condomínio, SE estiverem impressos. O apartamento é sempre numérico. O bloco pode ter letra no final (ex: "12B") — transcreva exatamente como impresso, não arredonde para só números.
- Todo o texto legível da etiqueta em "rawText".
- Uma confiança de 0 a 100 refletindo a nitidez e completude da leitura.
Se algum campo não estiver legível ou não existir na etiqueta, retorne null para ele (exceto carrier, rawText e confidence, que são obrigatórios).`;

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
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: PROMPT }, { inlineData: { mimeType, data: rawBase64 } }] }],
    config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA }
  });

  console.log(JSON.stringify(JSON.parse(response.text), null, 2));
})();
