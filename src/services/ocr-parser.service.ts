import { Carrier } from '../types';

export interface ExtractedLabelData {
  rawText: string;
  recipientName: string | null;
  block: number | null;
  apartment: number | null;
  trackingCode: string | null;
  carrier: Carrier;
  carrierConfidence: number; // 0 to 100
  barcodeType?: string;
  notes?: string;
  preprocessedImageUrl?: string;
  extractionQuality: 'EXCELLENT' | 'GOOD' | 'PARTIAL' | 'POOR';
  missingFields: Array<'recipientName' | 'unit' | 'trackingCode' | 'carrier'>;
}

export interface SampleLabelScenario {
  id: string;
  title: string;
  carrier: Carrier;
  badge: string;
  description: string;
  samplePhotoUrl: string;
  ocrRawText: string;
  expectedResult: {
    recipientName: string;
    block: number;
    apartment: number;
    trackingCode: string;
    carrier: Carrier;
  };
}

export class OcrParserService {
  /**
   * Pre-processes an image on HTML5 Canvas:
   * - Grayscale conversion
   * - Contrast adjustment
   * - Adaptive thresholding/binarization
   */
  public preprocessImageCanvas(
    sourceImage: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
    options: {
      contrast?: number; // e.g. 1.4
      binarize?: boolean;
      threshold?: number; // 0-255, e.g. 128
      width?: number;
      height?: number;
    } = {}
  ): { canvas: HTMLCanvasElement; dataUrl: string } {
    const {
      contrast = 1.35,
      binarize = true,
      threshold = 120,
      width = 800,
      height = 600
    } = options;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return { canvas, dataUrl: '' };
    }

    // Draw source
    ctx.drawImage(sourceImage, 0, 0, width, height);

    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      // Contrast factor
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // 1. Grayscale (Luminance Rec. 709)
        let gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        // 2. Contrast Enhancement
        gray = factor * (gray - 128) + 128;
        gray = Math.max(0, Math.min(255, gray));

        // 3. Binarization (Adaptive / Thresholding)
        if (binarize) {
          gray = gray >= threshold ? 255 : 0;
        }

        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      ctx.putImageData(imgData, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      return { canvas, dataUrl };
    } catch {
      // Fallback if tainted canvas
      return { canvas, dataUrl: '' };
    }
  }

  /**
   * Refined regex parser for Brazilian e-commerce logistics labels
   */
  public parseLabelText(rawText: string, preprocessedImageUrl?: string): ExtractedLabelData {
    const text = rawText.replace(/\r\n/g, '\n');
    const missingFields: Array<'recipientName' | 'unit' | 'trackingCode' | 'carrier'> = [];

    // 1. CARRIER DETECTION
    const carrierResult = this.detectCarrier(text);
    const carrier = carrierResult.carrier;

    // 2. TRACKING CODE / BARCODE EXTRACTION
    const trackingCode = this.extractTrackingCode(text, carrier);
    if (!trackingCode) {
      missingFields.push('trackingCode');
    }

    // 3. UNIT (BLOCK & APARTMENT) EXTRACTION
    const unitResult = this.extractUnit(text);
    if (!unitResult.block || !unitResult.apartment) {
      missingFields.push('unit');
    }

    // 4. RECIPIENT NAME EXTRACTION
    const recipientName = this.extractRecipientName(text);
    if (!recipientName) {
      missingFields.push('recipientName');
    }

    // 5. QUALITY ASSESSMENT
    let extractionQuality: ExtractedLabelData['extractionQuality'] = 'EXCELLENT';
    if (missingFields.length === 0) {
      extractionQuality = 'EXCELLENT';
    } else if (missingFields.length === 1 && !missingFields.includes('unit')) {
      extractionQuality = 'GOOD';
    } else if (missingFields.includes('unit') && missingFields.length <= 2) {
      extractionQuality = 'PARTIAL';
    } else {
      extractionQuality = 'POOR';
    }

    return {
      rawText: text,
      recipientName,
      block: unitResult.block,
      apartment: unitResult.apartment,
      trackingCode,
      carrier,
      carrierConfidence: carrierResult.confidence,
      preprocessedImageUrl,
      extractionQuality,
      missingFields
    };
  }

  /**
   * Detects carrier based on logistics keywords and branding headers
   */
  private detectCarrier(text: string): { carrier: Carrier; confidence: number } {
    const lower = text.toLowerCase();

    if (
      lower.includes('mercado livre') ||
      lower.includes('mercado envios') ||
      lower.includes('meli') ||
      lower.includes('mlb') ||
      lower.includes('envio full')
    ) {
      return { carrier: 'Mercado Livre', confidence: 98 };
    }

    if (
      lower.includes('correios') ||
      lower.includes('sedex') ||
      lower.includes('pac') ||
      lower.includes('ect') ||
      /\b[a-z]{2}\d{9}br\b/i.test(text)
    ) {
      return { carrier: 'Correios', confidence: 96 };
    }

    if (
      lower.includes('amazon') ||
      lower.includes('prime') ||
      lower.includes('amz') ||
      lower.includes('amazon logistics') ||
      /\btba\d{10,14}\b/i.test(text)
    ) {
      return { carrier: 'Amazon', confidence: 97 };
    }

    if (
      lower.includes('shopee') ||
      lower.includes('shopee xpress') ||
      lower.includes('spx') ||
      lower.includes('spx express')
    ) {
      return { carrier: 'Shopee', confidence: 98 };
    }

    if (lower.includes('loggi') || lower.includes('log-')) {
      return { carrier: 'Loggi', confidence: 95 };
    }

    return { carrier: 'Outra', confidence: 50 };
  }

  /**
   * Extracts tracking numbers based on carrier-specific formats
   */
  private extractTrackingCode(text: string, carrier: Carrier): string | null {
    // 1. Correios format: 2 letters + 9 digits + 2 letters (e.g. NL928374102BR, BR123456789BR)
    const correiosMatch = text.match(/\b([A-Z]{2}\s*\d{9}\s*[A-Z]{2})\b/i);
    if (correiosMatch) {
      return correiosMatch[1].replace(/\s+/g, '').toUpperCase();
    }

    // 2. Mercado Livre format: ML-894720194BR or MLB123456789 or 10-14 digits sequence
    const mlPrefixed = text.match(/\b(ML-?\d{8,12}(?:BR)?)\b/i);
    if (mlPrefixed) {
      return mlPrefixed[1].toUpperCase();
    }

    // 3. Amazon format: AMZ-BR-10294820 or TBA123456789012
    const amzMatch = text.match(/\b(AMZ-BR-\d{7,10}|TBA\d{10,14}|AMZ\d{8,12})\b/i);
    if (amzMatch) {
      return amzMatch[1].toUpperCase();
    }

    // 4. Shopee format: SHP-9920184712 or SPXBR123456789 or BR23091823901J
    const shpMatch = text.match(/\b(SHP-?\d{8,12}|SPXBR\d{8,14}|BR\d{10,14}[A-Z]?)\b/i);
    if (shpMatch) {
      return shpMatch[1].toUpperCase();
    }

    // 5. Loggi format: LOG-772910482
    const loggiMatch = text.match(/\b(LOG-?\d{7,12})\b/i);
    if (loggiMatch) {
      return loggiMatch[1].toUpperCase();
    }

    // 6. Explicit label field keywords: "Rastreio:", "Código:", "Tracking:", "Guia:"
    const trackingKeywordMatch = text.match(
      /(?:rastreio|tracking|c[oó]digo|guia|awb|etiqueta|pedido)\s*[:#.-]?\s*([A-Z0-9-]{8,24})/i
    );
    if (trackingKeywordMatch && trackingKeywordMatch[1].length >= 8) {
      return trackingKeywordMatch[1].toUpperCase();
    }

    // 7. General barcode sequence (10 to 44 digits)
    const longDigits = text.match(/\b(\d{10,24})\b/);
    if (longDigits) {
      return longDigits[1];
    }

    return null;
  }

  /**
   * Extracts Block (1-12) and Apartment (101-802) using multiple pattern matchers
   */
  private extractUnit(text: string): { block: number | null; apartment: number | null } {
    let block: number | null = null;
    let apartment: number | null = null;

    // Pattern A: "Bloco 03 - Apt 102" or "Bl 3 Ap 102" or "Bloco 3, Apto 102"
    const patternA = text.match(
      /(?:bloco|bl|b)\.?\s*0?([1-9]|1[0-2])\s*(?:-|–|\/|,|\s)\s*(?:apto?|apt|apartamento|ap|unid|unidade)?\.?\s*([1-8]0[1-4]|80[12])/i
    );
    if (patternA) {
      block = parseInt(patternA[1], 10);
      apartment = parseInt(patternA[2], 10);
      return { block, apartment };
    }

    // Pattern B: "Apt 102 - Bloco 3" or "Apto 102 Bl 03"
    const patternB = text.match(
      /(?:apto?|apt|apartamento|ap)\.?\s*([1-8]0[1-4]|80[12])\s*(?:-|–|\/|,|\s)\s*(?:bloco|bl|b)\.?\s*0?([1-9]|1[0-2])/i
    );
    if (patternB) {
      apartment = parseInt(patternB[1], 10);
      block = parseInt(patternB[2], 10);
      return { block, apartment };
    }

    // Pattern C: "B03-A102" or "B3-A102"
    const patternC = text.match(/\bB0?([1-9]|1[0-2])\s*[-/]?\s*A([1-8]0[1-4]|80[12])\b/i);
    if (patternC) {
      block = parseInt(patternC[1], 10);
      apartment = parseInt(patternC[2], 10);
      return { block, apartment };
    }

    // Pattern D: "102-B3" or "102/B03"
    const patternD = text.match(/\b([1-8]0[1-4]|80[12])\s*[-/]\s*B0?([1-9]|1[0-2])\b/i);
    if (patternD) {
      apartment = parseInt(patternD[1], 10);
      block = parseInt(patternD[2], 10);
      return { block, apartment };
    }

    // Separate matching for Bloco and Apt
    if (!block) {
      const blockMatch = text.match(/(?:bloco|bl|b)\.?\s*0?([1-9]|1[0-2])\b/i);
      if (blockMatch) {
        block = parseInt(blockMatch[1], 10);
      }
    }

    if (!apartment) {
      const aptMatch = text.match(/(?:apto?|apt|apartamento|ap|unid)\.?\s*([1-8]0[1-4]|80[12])\b/i);
      if (aptMatch) {
        apartment = parseInt(aptMatch[1], 10);
      } else {
        // Fallback: search for 3-digit apt numbers (101-802)
        const standaloneApt = text.match(/\b([1-8]0[1-4]|80[12])\b/);
        if (standaloneApt) {
          apartment = parseInt(standaloneApt[1], 10);
        }
      }
    }

    return { block, apartment };
  }

  /**
   * Extracts recipient name from label headers
   */
  private extractRecipientName(text: string): string | null {
    // 1. Explicit label anchors
    const anchorMatch = text.match(
      /(?:destinat[aá]rio|recebedor|entregar para|cliente|nome|para|dest)\s*[:#.-]?\s*([A-Za-zÀ-ÖØ-öø-ÿ\s]{3,40})/i
    );

    if (anchorMatch && anchorMatch[1]) {
      const cleaned = anchorMatch[1]
        .split('\n')[0]
        .replace(/^(sr|sra|dr|dra)\.?\s+/i, '')
        .trim();
      if (cleaned.length >= 3) {
        return this.capitalizeName(cleaned);
      }
    }

    // 2. Scan lines for typical 2-4 word Brazilian full names (e.g. "Beatriz Lima", "Carlos Silva")
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    for (const line of lines) {
      // Skip system/address lines
      if (
        /mercado|correios|amazon|shopee|loggi|jadlog|sedex|pac|bloco|apto?|rua|av|avenida|cep|bairro|condominio|village|azaleia|rastreio|pacote/i.test(
          line
        )
      ) {
        continue;
      }

      // Check if line consists solely of words with capital letters
      const words = line.split(/\s+/);
      if (words.length >= 2 && words.length <= 4) {
        const isLikelyName = words.every(
          (w) => /^[A-Za-zÀ-ÖØ-öø-ÿ]+$/.test(w) && w.length >= 2
        );
        if (isLikelyName) {
          return this.capitalizeName(line);
        }
      }
    }

    return null;
  }

  private capitalizeName(name: string): string {
    return name
      .toLowerCase()
      .split(/\s+/)
      .map((word) => {
        if (['de', 'da', 'do', 'dos', 'das', 'e'].includes(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }
}

export const ocrParserService = new OcrParserService();

/**
 * High-fidelity sample labels for 1-click zero-digitation demo & testing
 */
export const SAMPLE_LABEL_SCENARIOS: SampleLabelScenario[] = [
  {
    id: 'sample-ml-01',
    title: 'Mercado Livre • Beatriz Lima (Bl 3 Apt 102)',
    carrier: 'Mercado Livre',
    badge: '100% Reconhecimento',
    description: 'Etiqueta padrão Mercado Envios com código de barras, bloco e apto nítidos.',
    samplePhotoUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=600&auto=format&fit=crop&q=80',
    ocrRawText: `MERCADO LIVRE - MERCADO ENVIOS FULL
----------------------------------------------
DESTINATÁRIO: Beatriz Lima
ENDEREÇO: Residencial Village Azaleia
Rua das Acácias, 500 - Bloco 03 - Apt 102
Bairro Floresta - CEP 04571-010
RASTREIO: ML-894720194BR
ROTA: SP-CAPITAL-ZONA-SUL / HUB-04
CODIGO BARRAS: |||||||||||||||||||||||||||||||||||
42019482710394829104820194`,
    expectedResult: {
      recipientName: 'Beatriz Lima',
      block: 3,
      apartment: 102,
      trackingCode: 'ML-894720194BR',
      carrier: 'Mercado Livre'
    }
  },
  {
    id: 'sample-correios-02',
    title: 'Correios SEDEX • Carlos Silva (Bl 1 Apt 201)',
    carrier: 'Correios',
    badge: '100% Reconhecimento',
    description: 'Etiqueta postal padrão Correios com código de 13 dígitos NL928374102BR.',
    samplePhotoUrl: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=600&auto=format&fit=crop&q=80',
    ocrRawText: `CORREIOS - SEDEX CONVENCIONAL
DESTINATÁRIO: Carlos Silva
RESIDENCIAL VILLAGE AZALEIA
Bloco 01 - Apartamento 201
CEP: 04571-010 - São Paulo/SP
OBJETO: NL928374102BR
CHAVE: 3524 0812 9482 0192 8492 5500 1000 2938 1019
DECLARAÇÃO DE CONTEÚDO ELETRÔNICOS`,
    expectedResult: {
      recipientName: 'Carlos Silva',
      block: 1,
      apartment: 201,
      trackingCode: 'NL928374102BR',
      carrier: 'Correios'
    }
  },
  {
    id: 'sample-amazon-03',
    title: 'Amazon Prime • Juliana Costa (Bl 2 Apt 104)',
    carrier: 'Amazon',
    badge: '100% Reconhecimento',
    description: 'Etiqueta Amazon Logistics com identificação Prime e slot rápido.',
    samplePhotoUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80',
    ocrRawText: `AMAZON LOGISTICS - PRIME 1-DAY
DELIVERY TO: Juliana Costa
CONDOMINIO VILLAGE AZALEIA
B02-A104 (BLOCO 2 APT 104)
TRACKING: AMZ-BR-10294820
CYCLE 1 - DSP-BR-GRU2
|||||||||||||||||||||||||||||||||||||||||||||
TBA918239019284`,
    expectedResult: {
      recipientName: 'Juliana Costa',
      block: 2,
      apartment: 104,
      trackingCode: 'AMZ-BR-10294820',
      carrier: 'Amazon'
    }
  },
  {
    id: 'sample-shopee-04',
    title: 'Shopee Xpress • Mariana Souza (Bl 5 Apt 304)',
    carrier: 'Shopee',
    badge: '100% Reconhecimento',
    description: 'Etiqueta Shopee Xpress com código SPXBR.',
    samplePhotoUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80',
    ocrRawText: `SHOPEE XPRESS (SPX)
RECEBEDOR: Mariana Souza
END: RUA DAS ACACIAS 500 - BL 05 AP 304
SAO PAULO - SP
CODIGO: SHP-9920184712
SPXBR23091823901J
CANAL DE DISTRIBUICAO SP-03`,
    expectedResult: {
      recipientName: 'Mariana Souza',
      block: 5,
      apartment: 304,
      trackingCode: 'SHP-9920184712',
      carrier: 'Shopee'
    }
  },
  {
    id: 'sample-loggi-05',
    title: 'Loggi Express • Rodrigo Alves (Bl 7 Apt 502)',
    carrier: 'Loggi',
    badge: '100% Reconhecimento',
    description: 'Etiqueta Loggi com código LOG e entrega rápida.',
    samplePhotoUrl: 'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=600&auto=format&fit=crop&q=80',
    ocrRawText: `LOGGI TECNOLOGIA E LOGISTICA
PARA: Rodrigo Alves
BLOCO 7 / APARTAMENTO 502 - VILLAGE AZALEIA
PACOTE: LOG-772910482
ROTA EXPRESSA ZONA SUL`,
    expectedResult: {
      recipientName: 'Rodrigo Alves',
      block: 7,
      apartment: 502,
      trackingCode: 'LOG-772910482',
      carrier: 'Loggi'
    }
  },
  {
    id: 'sample-damaged-06',
    title: 'Etiqueta Parcial/Rasurada • Fernando (Bl 4 Apt 401)',
    carrier: 'Correios',
    badge: 'Fallback Amarelo (Faltando Rastreio)',
    description: 'Simula etiqueta danificada onde o morador é identificado mas o código de rastreio precisa de confirmação.',
    samplePhotoUrl: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=600&auto=format&fit=crop&q=80',
    ocrRawText: `CORREIOS - ENCOMENDA
DESTINATÁRIO: Fernando Rodrigues
Condomínio Village Azaleia - Bloco 4 Apt 401
[CÓDIGO DE BARRAS RASURADO - ILEGÍVEL]`,
    expectedResult: {
      recipientName: 'Fernando Rodrigues',
      block: 4,
      apartment: 401,
      trackingCode: '',
      carrier: 'Correios'
    }
  }
];
