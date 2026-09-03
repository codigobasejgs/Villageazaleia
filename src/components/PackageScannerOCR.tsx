import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Zap,
  Sparkles,
  Layers,
  Upload,
  CheckCircle,
  AlertTriangle,
  FileText,
  Sliders,
  Maximize2,
  X,
  Play,
  Pause,
  ScanLine
} from 'lucide-react';
import {
  ocrParserService,
  ExtractedLabelData,
  SAMPLE_LABEL_SCENARIOS,
  SampleLabelScenario
} from '../services/ocr-parser.service';
import { geminiOcrService } from '../services/gemini-ocr.service';
import { sound } from '../utils/audio';

interface PackageScannerOCRProps {
  onScanComplete: (
    extractedData: ExtractedLabelData,
    capturedPhotoUrl: string,
    preprocessedPhotoUrl?: string
  ) => void;
  onClose?: () => void;
  isProcessing?: boolean;
}

export const PackageScannerOCR: React.FC<PackageScannerOCRProps> = ({
  onScanComplete,
  onClose,
  isProcessing = false
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isContinuousMode, setIsContinuousMode] = useState<boolean>(false);
  const [showPreprocessedView, setShowPreprocessedView] = useState<boolean>(false);
  const [contrastLevel, setContrastLevel] = useState<number>(1.4);
  const [binarizeThreshold, setBinarizeThreshold] = useState<number>(125);
  const [scannerStatus, setScannerStatus] = useState<string>('Pronto para leitura');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [lastScannedPreview, setLastScannedPreview] = useState<string | null>(null);
  const [preprocessedPreview, setPreprocessedPreview] = useState<string | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  // Initialize camera stream
  const startCamera = useCallback(async () => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCameraPermission(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          // 1920x1080 (era 1280x720) — texto de etiqueta (rastreio, bloco/apto) é pequeno;
          // mais resolução na captura ajuda o OCR sem custo perceptível (1 foto por vez, não vídeo).
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setHasCameraPermission(true);
        setScannerStatus('Câmera ativa. Enquadre a etiqueta.');
      }
    } catch (err) {
      console.warn('[Camera Access Error]', err);
      setHasCameraPermission(false);
      setScannerStatus('Câmera indisponível. Utilize os cenários de teste ou upload.');
    }
  }, [facingMode]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Switch Camera
  const toggleFacingMode = () => {
    sound.playScanBeep();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Perform Image Capture and OCR Pipeline
  // - Cenários de demonstração (explicitOcrText vindo de SAMPLE_LABEL_SCENARIOS) usam o
  //   parser regex local — rápido, grátis, sem depender de câmera/API.
  // - Foto real (câmera ao vivo ou upload de arquivo) usa o Gemini Vision real via
  //   /api/ocr/analyze-label (ver gemini-ocr.service.ts), com fallback pro parser local
  //   se a chamada falhar, pra nunca travar o atendimento.
  const captureAndAnalyze = useCallback(
    async (customImageSource?: HTMLImageElement | string, explicitOcrText?: string) => {
      setIsAnalyzing(true);
      setScannerStatus('Processando filtros de contraste e binarização...');
      sound.playScanBeep();

      await new Promise((resolve) => setTimeout(resolve, 400));

      let photoDataUrl = '';
      let preprocessedDataUrl = '';
      const isKnownScenario = typeof customImageSource === 'string' && Boolean(explicitOcrText);

      if (typeof customImageSource === 'string') {
        photoDataUrl = customImageSource;
        preprocessedDataUrl = customImageSource;
      } else if (videoRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current;
        const { dataUrl } = ocrParserService.preprocessImageCanvas(video, {
          contrast: contrastLevel,
          binarize: true,
          threshold: binarizeThreshold,
          width: video.videoWidth || 800,
          height: video.videoHeight || 600
        });

        // Standard capture
        const rawCanvas = document.createElement('canvas');
        rawCanvas.width = video.videoWidth || 800;
        rawCanvas.height = video.videoHeight || 600;
        const rawCtx = rawCanvas.getContext('2d');
        if (rawCtx) {
          rawCtx.drawImage(video, 0, 0, rawCanvas.width, rawCanvas.height);
          photoDataUrl = rawCanvas.toDataURL('image/jpeg', 0.95);
        } else {
          photoDataUrl = dataUrl;
        }

        preprocessedDataUrl = dataUrl;
      } else {
        // Fallback image
        photoDataUrl = SAMPLE_LABEL_SCENARIOS[0].samplePhotoUrl;
        preprocessedDataUrl = photoDataUrl;
      }

      setLastScannedPreview(photoDataUrl);
      setPreprocessedPreview(preprocessedDataUrl);

      let parsedResult: ExtractedLabelData | null = null;

      if (isKnownScenario) {
        // Cenário de teste pré-gravado — parser local, sem custo de API
        parsedResult = ocrParserService.parseLabelText(explicitOcrText!, preprocessedDataUrl);
      } else {
        setScannerStatus('Analisando etiqueta com IA (Gemini Vision)...');
        parsedResult = await geminiOcrService.analyzeLabelPhoto(photoDataUrl);
        if (parsedResult) {
          parsedResult = { ...parsedResult, preprocessedImageUrl: preprocessedDataUrl };
        }
      }

      if (!parsedResult) {
        // Gemini indisponível/falhou — cai pro parser local com texto vazio, garante que o
        // fluxo continua (fallback manual assume a partir daqui na tela de recepção).
        setScannerStatus('Não foi possível ler automaticamente. Preencha manualmente.');
        parsedResult = ocrParserService.parseLabelText('', preprocessedDataUrl);
      } else {
        setScannerStatus('✓ Leitura OCR concluída com sucesso!');
      }

      setIsAnalyzing(false);
      sound.playSuccess();

      onScanComplete(parsedResult, photoDataUrl, preprocessedDataUrl);
    },
    [contrastLevel, binarizeThreshold, onScanComplete]
  );

  // Trigger Sample Label Scenario for zero-friction testing
  const handleSelectScenario = (scenario: SampleLabelScenario) => {
    setActiveScenarioId(scenario.id);
    sound.playScanBeep();
    setScannerStatus(`Carregando etiqueta de teste: ${scenario.carrier}...`);

    captureAndAnalyze(scenario.samplePhotoUrl, scenario.ocrRawText);
  };

  // Upload local file for OCR
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        sound.playScanBeep();
        setScannerStatus('Foto da etiqueta carregada. Executando OCR real com IA...');
        // Foto real enviada pelo usuário — sem texto explícito, então vai pro Gemini Vision
        captureAndAnalyze(result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-slate-900 border-2 border-[#D4AF37]/50 rounded-3xl p-4 sm:p-6 text-white shadow-2xl space-y-4">
      {/* Header with Title and Mode Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D81B60] to-[#AD1457] flex items-center justify-center shadow-lg shadow-[#D81B60]/30 border border-[#FFF2B2]/30">
            <ScanLine className="w-5 h-5 text-[#FFF2B2] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#FFF2B2]">
                Visão Computacional & OCR
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#0D3823] text-emerald-300 text-[10px] font-black border border-emerald-500/40">
                100% AUTOMÁTICO
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              Scanner Inteligente de Etiquetas
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setShowPreprocessedView(!showPreprocessedView)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              showPreprocessedView
                ? 'bg-[#D4AF37] text-[#0D3823] border-[#FFF2B2]'
                : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/15'
            }`}
            title="Exibe a visão binarizada de alto contraste usada pelo OCR"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filtro Binarização</span>
          </button>

          {hasCameraPermission && (
            <button
              type="button"
              onClick={toggleFacingMode}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 transition-colors"
              title="Alternar Câmera Frontal/Traseira"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/30 hover:text-rose-300 text-slate-400 border border-white/15 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left / Center: Camera Stream with Viewfinder */}
        <div className="lg:col-span-8 flex flex-col justify-between bg-black/80 rounded-2xl overflow-hidden border border-white/15 relative min-h-[340px] sm:min-h-[400px]">
          {/* Top Status Bar in Viewfinder */}
          <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none">
            <div className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-[11px] font-semibold text-white flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isAnalyzing
                    ? 'bg-amber-400 animate-ping'
                    : hasCameraPermission
                    ? 'bg-emerald-400'
                    : 'bg-rose-400'
                }`}
              />
              <span>{scannerStatus}</span>
            </div>

            <div className="px-2.5 py-1 rounded-full bg-[#0D3823]/80 backdrop-blur-md border border-[#D4AF37]/40 text-[10px] font-mono text-[#FFF2B2]">
              RESIDENCIAL VILLAGE AZALEIA
            </div>
          </div>

          {/* Video or Fallback Canvas */}
          <div className="relative w-full h-full flex-1 flex items-center justify-center overflow-hidden bg-slate-950">
            {hasCameraPermission !== false ? (
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`w-full h-full object-cover min-h-[340px] ${
                  showPreprocessedView ? 'filter grayscale contrast-200' : ''
                }`}
              />
            ) : (
              <div className="p-8 text-center space-y-3">
                <Camera className="w-12 h-12 text-slate-500 mx-auto" />
                <div className="text-sm font-bold text-slate-300">
                  Câmera não conectada neste dispositivo
                </div>
                <p className="text-xs text-slate-400 max-w-sm">
                  Utilize um dos cenários de teste abaixo para simular etiquetas reais instantaneamente ou faça upload de uma foto.
                </p>
              </div>
            )}

            {/* Bounding Box / Laser Viewfinder overlay */}
            <div className="absolute inset-6 sm:inset-10 border-2 border-dashed border-[#D4AF37] rounded-2xl pointer-events-none flex flex-col justify-between p-4 shadow-inner">
              {/* Corner brackets */}
              <div className="flex justify-between">
                <div className="w-6 h-6 border-t-4 border-l-4 border-[#FFF2B2] rounded-tl-lg" />
                <div className="w-6 h-6 border-t-4 border-r-4 border-[#FFF2B2] rounded-tr-lg" />
              </div>

              {/* Laser animation line */}
              <div className="relative w-full py-1">
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#D81B60] to-transparent shadow-[0_0_12px_#D81B60] animate-bounce" />
                <div className="text-center text-[10px] uppercase font-mono tracking-widest text-[#FFF2B2]/80 mt-1">
                  POSICIONE A ETIQUETA COM BLOCO, APT E CÓDIGO DENTRO DESTA ÁREA
                </div>
              </div>

              <div className="flex justify-between">
                <div className="w-6 h-6 border-b-4 border-l-4 border-[#FFF2B2] rounded-bl-lg" />
                <div className="w-6 h-6 border-b-4 border-r-4 border-[#FFF2B2] rounded-br-lg" />
              </div>
            </div>

            {/* Loading Scan Overlay */}
            {isAnalyzing && (
              <div className="absolute inset-0 bg-[#061D12]/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#D81B60] to-[#AD1457] flex items-center justify-center shadow-xl shadow-[#D81B60]/40 border border-[#FFF2B2]/40 animate-pulse">
                  <Sparkles className="w-7 h-7 text-[#FFF2B2]" />
                </div>
                <div className="text-center space-y-1">
                  <h4 className="text-base font-black text-white">Processando OCR Inteligente</h4>
                  <p className="text-xs text-slate-300 font-medium">
                    Extraindo destinatário, bloco, apartamento e código de rastreio...
                  </p>
                </div>
                <div className="w-48 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#D81B60] animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Live Controls */}
          <div className="p-3 sm:p-4 bg-slate-900/90 backdrop-blur-md border-t border-white/10 flex flex-wrap items-center justify-between gap-3 z-20">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-white/15 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-[#FFF2B2]" />
                <span>Upload de Foto</span>
              </button>
            </div>

            <button
              type="button"
              disabled={isAnalyzing || isProcessing}
              onClick={() => captureAndAnalyze()}
              className="flex-1 sm:flex-initial px-6 py-3 rounded-2xl bg-gradient-to-r from-[#D81B60] via-[#E91E63] to-[#AD1457] hover:from-[#AD1457] hover:to-[#880E4F] text-white font-black text-sm shadow-xl shadow-[#D81B60]/30 border border-[#FFF2B2]/30 flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
            >
              <Camera className="w-4 h-4 text-[#FFF2B2]" />
              <span>Escanear Etiqueta Agora</span>
            </button>
          </div>
        </div>

        {/* Right: Quick Label Simulator & Real Samples */}
        <div className="lg:col-span-4 flex flex-col justify-between bg-slate-950/80 rounded-2xl border border-white/15 p-4 space-y-3">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Simulador de Etiquetas Reais
                </span>
              </div>
              <span className="text-[10px] text-[#FFF2B2] font-mono">1-CLIQUE</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
              Clique em qualquer transportadora abaixo para testar instantaneamente a extração por OCR e preenchimento zero-digitação:
            </p>
          </div>

          {/* Scenario Buttons List */}
          <div className="space-y-2 overflow-y-auto max-h-[320px] pr-1">
            {SAMPLE_LABEL_SCENARIOS.map((scenario) => {
              const isSelected = activeScenarioId === scenario.id;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => handleSelectScenario(scenario)}
                  disabled={isAnalyzing}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-[#0D3823]/80 border-[#D4AF37] text-white shadow-md'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/20 bg-black">
                    <img
                      src={scenario.samplePhotoUrl}
                      alt={scenario.carrier}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs text-white truncate">
                        {scenario.carrier}
                      </span>
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                          scenario.id === 'sample-damaged-06'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {scenario.id === 'sample-damaged-06' ? 'Fallback' : '100% OCR'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-300 font-medium truncate">
                      {scenario.expectedResult.recipientName}
                    </div>

                    <div className="text-[10px] text-[#FFF2B2] font-mono">
                      Bl {scenario.expectedResult.block} • Apt {scenario.expectedResult.apartment}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Information badge */}
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] text-slate-400 space-y-1">
            <div className="font-bold text-slate-300 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pipeline Automatizado Ativo</span>
            </div>
            <p>
              O OCR pré-processa a imagem, detecta a transportadora, cruza com os 360 moradores do condomínio e sugere a estante com menor ocupação.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
