import { Carrier } from '../types';
import { ExtractedLabelData } from './ocr-parser.service';
import { supabase } from '../lib/supabase';

interface GeminiLabelResponse {
  carrier: Carrier;
  trackingCode: string | null;
  recipientName: string | null;
  // Bloco pode ter letra (ex: "12B") — igual ao tipo de Unit.block em types.ts.
  block: string | null;
  apartment: number | null;
  rawText: string;
  confidence: number;
  error?: string;
}

export interface GeminiOcrResult {
  data: ExtractedLabelData | null;
  /** Presente se a falha foi de infraestrutura (auth, rede, servidor sem chave, cota) —
   * permite a tela mostrar o motivo real em vez de mascarar como "etiqueta ilegível". */
  errorMessage?: string;
}

/**
 * Chama /api/ocr/analyze-label (backend seguro, Gemini Vision) pra ler uma foto real de
 * etiqueta e extrair transportadora, rastreio, destinatário e bloco/apto. A chave Gemini
 * nunca sai do servidor — ver api/ocr/analyze-label.ts.
 */
export const geminiOcrService = {
  async analyzeLabelPhoto(imageDataUrl: string): Promise<GeminiOcrResult> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';

      if (!token) {
        return {
          data: null,
          errorMessage: 'Sessão não encontrada ou expirada. Faça login novamente antes de usar o OCR.'
        };
      }

      const response = await fetch('/api/ocr/analyze-label', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ imageBase64: imageDataUrl }),
        // Timeout de 25s: o modelo Gemini pode demorar em imagens complexas, mas
        // nunca deixa a tela travada indefinidamente.
        signal: AbortSignal.timeout(25000)
      });

      if (!response.ok) {
        let msg = `Falha no servidor (${response.status})`;
        try {
          const errBody = await response.json();
          if (errBody?.error) msg = errBody.error;
        } catch {
          // ignora
        }
        console.warn('[Gemini OCR] Erro HTTP:', response.status, msg);
        return { data: null, errorMessage: msg };
      }

      const data: GeminiLabelResponse = await response.json();
      if (data.error) {
        console.warn('[Gemini OCR] Erro retornado pelo servidor:', data.error);
        return { data: null, errorMessage: data.error };
      }

      const missingFields: ExtractedLabelData['missingFields'] = [];
      if (!data.trackingCode) missingFields.push('trackingCode');
      if (!data.block || !data.apartment) missingFields.push('unit');
      if (!data.recipientName) missingFields.push('recipientName');

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
        data: {
          rawText: data.rawText || '',
          recipientName: data.recipientName,
          block: data.block,
          apartment: data.apartment,
          trackingCode: data.trackingCode,
          carrier: data.carrier,
          carrierConfidence: data.confidence,
          extractionQuality,
          missingFields
        }
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'TimeoutError';
      const msg = isTimeout
        ? 'Tempo limite de resposta excedido (25s). Tente novamente.'
        : err?.message || 'Falha de conexão com o servidor de OCR.';
      console.warn('[Gemini OCR] Falha ao chamar /api/ocr/analyze-label:', err);
      return { data: null, errorMessage: msg };
    }
  }
};
