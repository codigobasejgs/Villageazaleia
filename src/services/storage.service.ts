import { supabase } from '../lib/supabase';

const BUCKET_NAME = 'village-azaleia-storage';

/**
 * Converte uma string base64 / Data URL em Blob binário para upload limpo
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1] || arr[0]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export const storageService = {
  /**
   * Faz upload de uma imagem (DataURL Base64 ou Blob) para o Supabase Storage Bucket
   * Retorna a URL pública permanente do Supabase. Se falhar, retorna o base64 original como fallback.
   */
  async uploadFile(
    folder: 'packages' | 'handovers' | 'signatures',
    dataUrlOrBlob: string | Blob,
    customFilename?: string
  ): Promise<string> {
    try {
      if (typeof dataUrlOrBlob === 'string' && dataUrlOrBlob.startsWith('http')) {
        // Já é uma URL externa / hospedada
        return dataUrlOrBlob;
      }

      const extension = typeof dataUrlOrBlob === 'string' && dataUrlOrBlob.includes('image/png') ? 'png' : 'jpg';
      const filename = customFilename || `${folder}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extension}`;
      const filePath = `${folder}/${filename}`;

      let blob: Blob;
      let contentType = 'image/jpeg';

      if (typeof dataUrlOrBlob === 'string') {
        blob = dataUrlToBlob(dataUrlOrBlob);
        contentType = blob.type || 'image/jpeg';
      } else {
        blob = dataUrlOrBlob;
        contentType = dataUrlOrBlob.type || 'image/jpeg';
      }

      const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, blob, {
        contentType,
        cacheControl: '31536000',
        upsert: true
      });

      if (error) {
        console.warn(`[Supabase Storage] Upload error in ${folder}:`, error.message);
        // Fallback gracioso para base64/local
        return typeof dataUrlOrBlob === 'string' ? dataUrlOrBlob : '';
      }

      const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
      return publicUrlData.publicUrl;
    } catch (err) {
      console.warn(`[Supabase Storage] Exception in upload:`, err);
      return typeof dataUrlOrBlob === 'string' ? dataUrlOrBlob : '';
    }
  }
};
