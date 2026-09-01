import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, CheckCircle2, RefreshCw, QrCode, Smartphone, AlertCircle } from 'lucide-react';
import { sound } from '../utils/audio';

interface WhatsAppStatus {
  connected: boolean;
  exists: boolean;
  profileName?: string;
  number?: string;
  error?: string;
}

interface WhatsAppIntegrationPanelProps {
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

/**
 * Painel do Síndico pra conectar o WhatsApp real (Evolution API, instância dedicada
 * "village-azaleia") escaneando o QR Code. A apikey nunca é vista aqui — tudo passa
 * pelas funções serverless em api/whatsapp/*.ts.
 */
export const WhatsAppIntegrationPanel: React.FC<WhatsAppIntegrationPanelProps> = ({ onShowToast }) => {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  // Diagnóstico visível — mostra a resposta crua quando algo sai diferente do esperado,
  // pra nunca mais precisar reproduzir um problema "às cegas".
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      const data: WhatsAppStatus = await res.json();
      setStatus(data);
      if (data.connected) {
        setQrCodeBase64(null);
        setDebugInfo(null);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
      return data;
    } catch (err) {
      setStatus({ connected: false, exists: false, error: 'Falha ao consultar status.' });
      return null;
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    setDebugInfo(null);
    sound.playScanBeep();
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });

      if (!res.ok) {
        const rawText = await res.text();
        setDebugInfo(`HTTP ${res.status}: ${rawText.slice(0, 1500)}`);
        onShowToast(`Erro ${res.status} ao conectar. Veja o detalhe técnico abaixo do QR Code.`, 'warning');
        setIsConnecting(false);
        return;
      }

      const data = await res.json();

      if (data.status === 'error') {
        setDebugInfo(JSON.stringify(data, null, 2));
        onShowToast(data.error || 'Erro ao conectar com a Evolution API.', 'warning');
        setIsConnecting(false);
        return;
      }

      if (data.alreadyConnected && !data.qrCodeBase64) {
        // Pode ser "já conectado" de verdade, OU o servidor não achou o QR na resposta da
        // Evolution API (formato inesperado) — se veio debugRawResponse, mostra pra investigar.
        if (data.debugRawResponse) {
          setDebugInfo(
            'O servidor não encontrou o QR Code na resposta da Evolution API. Resposta crua recebida:\n\n' +
              JSON.stringify(data.debugRawResponse, null, 2).slice(0, 2000)
          );
          onShowToast('QR Code não veio no formato esperado. Veja o detalhe técnico abaixo.', 'warning');
        } else {
          onShowToast('WhatsApp já está conectado!', 'success');
          await fetchStatus();
        }
        setIsConnecting(false);
        return;
      }

      if (data.qrCodeBase64) {
        setQrCodeBase64(data.qrCodeBase64);
        onShowToast('QR Code gerado! Escaneie com o WhatsApp do condomínio.', 'info');

        // Poll status a cada 3s até conectar (QR Code do Evolution expira em ~60s, então
        // também renovamos automaticamente enquanto o síndico não escaneia)
        if (pollRef.current) clearInterval(pollRef.current);
        let elapsed = 0;
        pollRef.current = setInterval(async () => {
          elapsed += 3;
          const updated = await fetchStatus();
          if (updated?.connected) {
            sound.playSuccess();
            onShowToast('WhatsApp conectado com sucesso!', 'success');
          } else if (elapsed >= 55 && pollRef.current) {
            // QR expirando — pede um novo automaticamente
            clearInterval(pollRef.current);
            pollRef.current = null;
            handleConnect();
          }
        }, 3000);
      }
    } catch (err: any) {
      setDebugInfo(`Exceção no navegador: ${err?.message || String(err)}`);
      onShowToast('Erro de rede ao conectar com o WhatsApp.', 'warning');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-[#D4AF37]/50 p-6 shadow-md space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-[#0D3823]">Integração WhatsApp (Evolution API)</h3>
            <p className="text-xs text-slate-500 font-medium">
              Dispara automaticamente "encomenda chegou" e "encomenda retirada" pro número conectado.
            </p>
          </div>
        </div>

        {isLoadingStatus ? (
          <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Verificando...
          </span>
        ) : status?.connected ? (
          <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Conectado{status.profileName ? ` • ${status.profileName}` : ''}
          </span>
        ) : (
          <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Desconectado
          </span>
        )}
      </div>

      {status?.connected ? (
        <div className="p-4 rounded-2xl bg-[#E8F5E9] border border-[#A5D6A7] flex items-center gap-3 text-sm">
          <Smartphone className="w-5 h-5 text-[#0D3823] shrink-0" />
          <div className="text-[#0D3823] font-bold">
            Número conectado{status.number ? `: ${status.number}` : ''}. O disparo automático de mensagens está ativo.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {qrCodeBase64 ? (
            <div className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <img
                src={qrCodeBase64}
                alt="QR Code Evolution API"
                className="w-56 h-56 rounded-xl border-2 border-[#D4AF37] shadow-md bg-white p-2"
              />
              <p className="text-xs text-slate-600 font-semibold text-center max-w-xs">
                Abra o WhatsApp no celular do condomínio → Aparelhos conectados → Conectar um aparelho → escaneie este código.
              </p>
              <button
                type="button"
                onClick={handleConnect}
                disabled={isConnecting}
                className="text-xs font-bold text-[#D81B60] hover:text-[#AD1457] flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                Gerar novo QR Code
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#0D3823] to-[#15462D] hover:from-[#15462D] hover:to-[#0D3823] text-white font-black text-sm shadow-md flex items-center justify-center gap-2 transition-all border border-[#D4AF37]/40 active:scale-[0.99] disabled:opacity-50"
            >
              <QrCode className={`w-5 h-5 text-[#D4AF37] ${isConnecting ? 'animate-pulse' : ''}`} />
              <span>{isConnecting ? 'Gerando QR Code...' : 'Conectar WhatsApp'}</span>
            </button>
          )}

          {debugInfo && (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-1.5">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                Detalhe técnico (copie e envie se precisar de suporte)
              </span>
              <pre className="text-[10px] text-slate-300 font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                {debugInfo}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
