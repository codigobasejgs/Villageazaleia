import React, { useEffect, useState } from 'react';
import { PushNotification } from '../types';
import { VillageAzaleiaLogo } from './VillageAzaleiaLogo';
import { CARRIER_CONFIG } from '../data/mockData';
import {
  Bell,
  Package,
  QrCode,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Layers,
  MapPin,
  Clock
} from 'lucide-react';
import { sound } from '../utils/audio';

interface PushNotificationBannerProps {
  notification: PushNotification | null;
  onDismiss: () => void;
  onOpenResidentApp: (notification: PushNotification) => void;
  unreadCount?: number;
}

export const PushNotificationBanner: React.FC<PushNotificationBannerProps> = ({
  notification,
  onDismiss,
  onOpenResidentApp,
  unreadCount = 1
}) => {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!notification) {
      setProgress(100);
      return;
    }

    setProgress(100);
    const duration = 9000; // 9 seconds
    const interval = 50;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      if (!isPaused) {
        setProgress((prev) => {
          if (prev <= 0) {
            clearInterval(timer);
            onDismiss();
            return 0;
          }
          return prev - step;
        });
      }
    }, interval);

    return () => clearInterval(timer);
  }, [notification, isPaused, onDismiss]);

  if (!notification) return null;

  const carrierCfg = CARRIER_CONFIG[notification.carrier] || {
    color: '#D81B60',
    icon: '📦',
    lightBg: '#FCE4EC'
  };

  return (
    <div
      id="global-push-notification-banner"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="fixed top-4 right-4 z-[9999] max-w-md w-[calc(100%-2rem)] sm:w-[420px] transition-all duration-300 animate-in slide-in-from-top-6 fade-in"
    >
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#061D12]/95 via-[#0D3823]/95 to-[#061D12]/95 border-2 border-[#D4AF37] shadow-2xl backdrop-blur-xl text-white">
        {/* Glow ambient background */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#D81B60]/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-[#D4AF37]/15 rounded-full blur-2xl pointer-events-none" />

        {/* Progress bar */}
        <div className="w-full h-1 bg-black/40">
          <div
            className="h-full bg-gradient-to-r from-[#D4AF37] via-[#D81B60] to-[#D4AF37] transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-4 sm:p-5 space-y-3.5 relative z-10">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-xl bg-white/10 border border-[#D4AF37]/40 shadow-inner flex items-center justify-center">
                <VillageAzaleiaLogo variant="icon" size="sm" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-brand font-black text-xs text-white tracking-wide">
                    Village Azaleia
                  </span>
                  <span className="w-1 h-1 rounded-full bg-[#D4AF37]" />
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#D81B60] text-white font-extrabold tracking-wider uppercase">
                    PUSH
                  </span>
                </div>
                <span className="text-[10px] text-[#FFF2B2] font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#D4AF37]" /> Agora mesmo
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  sound.playScanBeep();
                  onDismiss();
                }}
                className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                title="Dispensar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#D81B60]/25 text-[#FFF2B2] border border-[#D81B60]/50 flex items-center justify-center shrink-0 shadow-md">
                <Bell className="w-4 h-4 text-[#FFF2B2] animate-bounce" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-black text-white leading-tight">
                  Nova encomenda recebida para sua unidade!
                </h4>
                <p className="text-xs text-white/80 leading-snug">
                  Morador(a) <strong className="text-[#FFF2B2]">{notification.residentName}</strong>, sua encomenda está pronta para retirada na Portaria Central.
                </p>
              </div>
            </div>

            {/* Package details mini card */}
            <div className="p-3 rounded-2xl bg-black/30 border border-[#D4AF37]/30 space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/70 font-sans font-medium">Destino:</span>
                <span className="font-sans font-extrabold text-[#FFF2B2] bg-[#D81B60]/30 px-2 py-0.5 rounded-md border border-[#D81B60]/50">
                  Bloco {notification.block} — Apt {notification.apartment}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/70 font-sans font-medium">Transportadora:</span>
                <span className="font-sans font-bold text-white flex items-center gap-1">
                  <span>{carrierCfg.icon}</span>
                  <span>{notification.carrier}</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/70 font-sans font-medium">Código:</span>
                <span className="font-bold text-[#FFF2B2]">{notification.trackingCode}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/70 font-sans font-medium">Localização:</span>
                <span className="font-sans font-extrabold text-emerald-300">
                  Estante {notification.shelfString}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                sound.playCheckout();
                onOpenResidentApp(notification);
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#D81B60] via-[#AD1457] to-[#880E4F] hover:from-[#AD1457] hover:to-[#730941] text-white font-extrabold text-xs shadow-lg shadow-[#D81B60]/30 transition-all flex items-center justify-center gap-1.5 border border-[#FFF2B2]/30 active:scale-95"
            >
              <QrCode className="w-3.5 h-3.5 text-[#FFF2B2]" />
              <span>Ver no App Morador & QR Code</span>
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
            <button
              onClick={() => {
                sound.playScanBeep();
                onDismiss();
              }}
              className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white font-bold text-xs transition-colors border border-white/20"
            >
              Depois
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
