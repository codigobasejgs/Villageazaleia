/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { PackageItem, ActivityLog, AuthSession, Unit, StaffAccount, PushNotification, MultichannelDispatchReport } from './types';
import { ALL_UNITS, INITIAL_PACKAGES, INITIAL_LOGS } from './data/mockData';
import { generateSeedStaffAccounts } from './data/staffAccounts';
import * as authService from './services/auth.service';
import { AppHeader } from './components/AppHeader';
import { PortariaView } from './components/PortariaView';
import { MoradorView } from './components/MoradorView';
import { TotemView } from './components/TotemView';
import { SindicoDashboard } from './components/SindicoDashboard';
import { PushNotificationBanner } from './components/PushNotificationBanner';
import { LandingScreen } from './components/auth/LandingScreen';
import { MoradorAuthScreen } from './components/auth/MoradorAuthScreen';
import { StaffLoginScreen } from './components/auth/StaffLoginScreen';
import { multichannelService } from './services/notifications/multichannel.service';
import { sound } from './utils/audio';
import { CheckCircle2, Info, AlertTriangle, X, ArrowLeft } from 'lucide-react';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

type PreAuthView = 'landing' | 'morador' | 'staff';

export default function App() {
  // 1. Auth session (null = ninguém logado). Persistida via src/services/auth.service.ts
  const [session, setSession] = useState<AuthSession | null>(() => authService.getSession());
  const [preAuthView, setPreAuthView] = useState<PreAuthView>('landing');
  const [totemMode, setTotemMode] = useState(false);

  // 2. Units state with localStorage persistence (360 units with up to 5 contact phones each)
  const [units, setUnits] = useState<Unit[]>(() => {
    try {
      const saved = localStorage.getItem('village_azaleia_units');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return ALL_UNITS;
  });

  // 3. Staff accounts (Portaria/Síndico) — seedadas uma vez (hash assíncrono via Web Crypto)
  // e persistidas do mesmo jeito que units/packages.
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>(() => {
    try {
      const saved = localStorage.getItem('village_azaleia_staff');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return [];
  });

  useEffect(() => {
    if (staffAccounts.length === 0) {
      generateSeedStaffAccounts().then(setStaffAccounts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4. Sound state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('village_azaleia_sound');
    return saved !== null ? saved === 'true' : true;
  });

  // 5. Packages state with localStorage persistence
  const [packages, setPackages] = useState<PackageItem[]>(() => {
    try {
      const saved = localStorage.getItem('village_azaleia_packages');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return INITIAL_PACKAGES;
  });

  // 6. Activity logs state with localStorage persistence
  const [logs, setLogs] = useState<ActivityLog[]>(() => {
    try {
      const saved = localStorage.getItem('village_azaleia_logs');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return INITIAL_LOGS;
  });

  // 7. Multichannel Dispatch Reports
  const [multichannelReports, setMultichannelReports] = useState<MultichannelDispatchReport[]>(() => {
    try {
      const saved = localStorage.getItem('village_azaleia_multichannel_reports');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return [];
  });

  // 8. Push notifications state
  const [pushNotifications, setPushNotifications] = useState<PushNotification[]>(() => {
    try {
      const saved = localStorage.getItem('village_azaleia_push_notifications');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return [
      {
        id: 'notif-initial-1',
        title: 'Nova encomenda recebida para sua unidade!',
        body: 'Morador(a) Beatriz Lima, seu pacote da Amazon (AMZ-BR-49201948) foi guardado na Estante A1. Apresente seu QR Code na Portaria.',
        packageId: 'pkg-1',
        block: 3,
        apartment: 102,
        residentName: 'Beatriz Lima',
        carrier: 'Amazon',
        trackingCode: 'AMZ-BR-49201948',
        shelfString: 'A1',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        read: false
      }
    ];
  });

  const [activePushPopup, setActivePushPopup] = useState<PushNotification | null>(null);

  // 9. Toast notifications state
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // 10. Deep link & Dev testing URL params: "?role=portaria|morador|totem|sindico&unit=B03-A102"
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const unitId = params.get('unit');
    const role = params.get('role');

    if (role === 'totem') {
      setTotemMode(true);
    } else if (role === 'portaria') {
      const portariaAccount = staffAccounts.find((s) => s.role === 'portaria') || { id: 'staff-portaria-1', name: 'Silvio Portaria', role: 'portaria' as const };
      setSession({ type: 'portaria', staffId: portariaAccount.id });
    } else if (role === 'sindico') {
      const sindicoAccount = staffAccounts.find((s) => s.role === 'sindico') || { id: 'staff-sindico-1', name: 'Marcos Síndico', role: 'sindico' as const };
      setSession({ type: 'sindico', staffId: sindicoAccount.id });
    } else if (role === 'morador') {
      const targetUnitId = unitId || units[0]?.id || 'B03-A102';
      setSession({ type: 'morador', unitId: targetUnitId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, staffAccounts]);

  // Persist/clear session on change
  useEffect(() => {
    if (session) {
      authService.setSession(session);
    } else {
      authService.clearSession();
    }
  }, [session]);

  // Sync sound engine
  useEffect(() => {
    sound.setEnabled(soundEnabled);
    localStorage.setItem('village_azaleia_sound', String(soundEnabled));
  }, [soundEnabled]);

  // Sync units to localStorage
  useEffect(() => {
    localStorage.setItem('village_azaleia_units', JSON.stringify(units));
  }, [units]);

  // Sync staff accounts to localStorage
  useEffect(() => {
    if (staffAccounts.length > 0) {
      localStorage.setItem('village_azaleia_staff', JSON.stringify(staffAccounts));
    }
  }, [staffAccounts]);

  // Sync packages to localStorage
  useEffect(() => {
    localStorage.setItem('village_azaleia_packages', JSON.stringify(packages));
  }, [packages]);

  // Sync logs to localStorage
  useEffect(() => {
    localStorage.setItem('village_azaleia_logs', JSON.stringify(logs));
  }, [logs]);

  // Sync multichannel reports to localStorage
  useEffect(() => {
    localStorage.setItem('village_azaleia_multichannel_reports', JSON.stringify(multichannelReports));
  }, [multichannelReports]);

  // Sync push notifications to localStorage
  useEffect(() => {
    localStorage.setItem('village_azaleia_push_notifications', JSON.stringify(pushNotifications));
  }, [pushNotifications]);

  // Show Toast helper
  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // New PWA build available (registered in main.tsx via virtual:pwa-register)
  useEffect(() => {
    const handleUpdateReady = () => {
      showToast('Nova versão do app disponível! Atualize a página para aplicar.', 'info');
    };
    window.addEventListener('village-azaleia:pwa-update-ready', handleUpdateReady);
    return () => window.removeEventListener('village-azaleia:pwa-update-ready', handleUpdateReady);
  }, []);

  // Trigger push notification dispatch
  const triggerPushNotification = (pkg: PackageItem) => {
    const newNotif: PushNotification = {
      id: `push-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: 'Nova encomenda recebida para sua unidade!',
      body: `Morador(a) ${pkg.residentName}, sua encomenda da ${pkg.carrier} (${pkg.trackingCode}) foi registrada e guardada na Estante ${pkg.shelf.shelf}${pkg.shelf.level}.`,
      packageId: pkg.id,
      block: pkg.block,
      apartment: pkg.apartment,
      residentName: pkg.residentName,
      carrier: pkg.carrier,
      trackingCode: pkg.trackingCode,
      shelfString: `${pkg.shelf.shelf}${pkg.shelf.level}`,
      timestamp: new Date().toISOString(),
      read: false
    };

    setPushNotifications((prev) => [newNotif, ...prev]);
    setActivePushPopup(newNotif);
    sound.playNotification();
  };

  // Add new package (Portaria or Totem) & Trigger Multichannel Notifications
  const handleAddPackage = async (
    pkgData: Omit<PackageItem, 'id' | 'status' | 'receivedAt' | 'qrToken' | 'registeredVia'> & {
      registeredVia?: 'PORTARIA' | 'TOTEM_ENTREGADOR';
      deliveryGuyName?: string;
    }
  ) => {
    const newId = `pkg-${Date.now()}`;
    const qrToken = `QR-B${String(pkgData.block).padStart(2, '0')}A${pkgData.apartment}-${newId.slice(-6).toUpperCase()}`;

    const newPackage: PackageItem = {
      ...pkgData,
      id: newId,
      status: 'ARMAZENADA',
      receivedAt: new Date().toISOString(),
      qrToken,
      registeredVia: pkgData.registeredVia || 'PORTARIA'
    };

    setPackages((prev) => [newPackage, ...prev]);

    // Create log entry for physical package entry
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      packageId: newId,
      trackingCode: newPackage.trackingCode,
      unitString: `Bloco ${newPackage.block} - Apt ${newPackage.apartment}`,
      action: pkgData.registeredVia === 'TOTEM_ENTREGADOR' ? 'TOTEM_REGISTRO' : 'ENTRADA',
      description: `Encomenda ${newPackage.carrier} registrada e armazenada na Estante ${newPackage.shelf.shelf}${newPackage.shelf.level}`,
      operator: newPackage.operatorName || 'Portaria Central'
    };

    setLogs((prev) => [newLog, ...prev]);

    // Push Notification Banner UI
    triggerPushNotification(newPackage);

    // Target Unit lookup for Multichannel dispatch (WhatsApp + Resend + Web Push)
    const targetUnit =
      units.find((u) => u.block === newPackage.block && u.apartment === newPackage.apartment) || {
        id: `B${String(newPackage.block).padStart(2, '0')}-A${newPackage.apartment}`,
        block: newPackage.block,
        apartment: newPackage.apartment,
        residentName: newPackage.residentName,
        residentPhone: '(11) 98765-4321',
        residentPhones: [
          { id: 'p1', label: 'Titular', number: '(11) 98765-4321', isWhatsapp: true }
        ],
        residentEmail: `${newPackage.residentName.toLowerCase().replace(/\s+/g, '.')}@email.com`
      };

    try {
      // Execute Multichannel Dispatch across Evolution API, Resend and Web Push
      const report = await multichannelService.dispatchAll(newPackage, targetUnit);
      setMultichannelReports((prev) => [report, ...prev]);

      // Add Multichannel Audit Log
      const multichannelLog: ActivityLog = {
        id: `log-notif-${Date.now()}`,
        timestamp: new Date().toISOString(),
        packageId: newId,
        trackingCode: newPackage.trackingCode,
        unitString: `Bloco ${newPackage.block} - Apt ${newPackage.apartment}`,
        action: 'NOTIFICACAO_MULTICANAL',
        description: `Disparo Multicanal: ${report.whatsappDispatches.length} WhatsApp(s), E-mail Resend e Web Push`,
        operator: 'Sistema Multicanal Village Azaleia'
      };

      setLogs((prev) => [multichannelLog, ...prev]);
    } catch (err) {
      console.warn('[Multichannel Dispatch Error]', err);
    }
  };

  // Test Push trigger for any unit
  const handleTriggerTestPush = (unit: Unit) => {
    const carriers = ['Mercado Livre', 'Amazon', 'Correios', 'Shopee', 'Loggi'] as const;
    const carrier = carriers[Math.floor(Math.random() * carriers.length)];
    const trackingCode = `TEST-${Math.floor(100000 + Math.random() * 900000)}`;

    const simulatedPackage: PackageItem = {
      id: `pkg-test-${Date.now()}`,
      trackingCode,
      unitId: unit.id,
      block: unit.block,
      apartment: unit.apartment,
      residentName: unit.residentName,
      carrier,
      shelf: { shelf: 'A', level: 1 },
      photoUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=400&q=80',
      status: 'ARMAZENADA',
      receivedAt: new Date().toISOString(),
      qrToken: `QR-B${String(unit.block).padStart(2, '0')}A${unit.apartment}-TEST`,
      registeredVia: 'PORTARIA'
    };

    triggerPushNotification(simulatedPackage);
    showToast(`Push disparado para Bloco ${unit.block} Apt ${unit.apartment} (${unit.residentName})!`, 'success');
  };

  // Pickup / Checkout package with digital signature, handover photo, and multichannel receipt dispatch
  const handlePickupPackage = async (
    pkgId: string,
    pickedUpBy: string,
    operatorName: string,
    signatureUrl?: string | null,
    handoverPhotoUrl?: string | null,
    receiptProtocol?: string
  ) => {
    const now = new Date().toISOString();
    const targetPkg = packages.find((p) => p.id === pkgId);
    if (!targetPkg) return;

    const protocol = receiptProtocol || `REC-VA-${Date.now().toString().slice(-8)}`;

    const updatedPackage: PackageItem = {
      ...targetPkg,
      status: 'RETIRADA',
      pickedUpAt: now,
      pickedUpBy: pickedUpBy || targetPkg.residentName,
      operatorName: operatorName || targetPkg.operatorName,
      signatureUrl: signatureUrl || undefined,
      handoverPhotoUrl: handoverPhotoUrl || undefined,
      receiptProtocol: protocol
    };

    setPackages((prev) =>
      prev.map((p) => (p.id === pkgId ? updatedPackage : p))
    );

    // Audit Log 1: RETIRADA
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      timestamp: now,
      packageId: pkgId,
      trackingCode: targetPkg.trackingCode,
      unitString: `Bloco ${targetPkg.block} - Apt ${targetPkg.apartment}`,
      action: 'RETIRADA',
      description: `Baixa confirmada para ${pickedUpBy || targetPkg.residentName} com Assinatura Digital e Foto`,
      operator: operatorName || 'Portaria Central'
    };

    // Audit Log 2: RECIBO_EMITIDO
    const receiptLog: ActivityLog = {
      id: `log-rec-${Date.now()}`,
      timestamp: now,
      packageId: pkgId,
      trackingCode: targetPkg.trackingCode,
      unitString: `Bloco ${targetPkg.block} - Apt ${targetPkg.apartment}`,
      action: 'RECIBO_EMITIDO',
      description: `Recibo Digital emitido sob protocolo ${protocol}`,
      operator: 'Sistema de Protocolo Digital'
    };

    setLogs((prev) => [receiptLog, newLog, ...prev]);

    // Confetti celebration on delivery
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch {
      // Ignore
    }

    // Lookup unit to dispatch delivery receipt via WhatsApp and Email
    const targetUnit =
      units.find((u) => u.block === targetPkg.block && u.apartment === targetPkg.apartment) || {
        id: `B${String(targetPkg.block).padStart(2, '0')}-A${targetPkg.apartment}`,
        block: targetPkg.block,
        apartment: targetPkg.apartment,
        residentName: targetPkg.residentName,
        residentPhone: '(11) 98765-4321',
        residentPhones: [
          { id: 'p1', label: 'Titular', number: '(11) 98765-4321', isWhatsapp: true }
        ],
        residentEmail: `${targetPkg.residentName.toLowerCase().replace(/\s+/g, '.')}@email.com`
      };

    try {
      const receiptReport = await multichannelService.dispatchDeliveryReceipt(updatedPackage, targetUnit);
      setMultichannelReports((prev) => [receiptReport, ...prev]);
    } catch (e) {
      console.warn('[Receipt dispatch error]', e);
    }
  };

  // Update a unit profile (resident name, phones up to 5, email, senha). Se o morador logado
  // mudar de bloco/apto, mantém a sessão apontando pra unidade nova.
  const handleUpdateUnit = (updatedUnit: Unit) => {
    setUnits((prev) =>
      prev.map((u) => (u.id === updatedUnit.id || (u.block === updatedUnit.block && u.apartment === updatedUnit.apartment) ? updatedUnit : u))
    );
    setSession((prev) => (prev && prev.type === 'morador' ? { type: 'morador', unitId: updatedUnit.id } : prev));
  };

  // Push Notification Banner click: nunca pula pro app do morador de outra unidade
  // (isso furaria o isolamento de sessão) — só dá contexto extra se for a própria sessão.
  const handleOpenResidentAppFromPush = (notification: PushNotification) => {
    setActivePushPopup(null);
    if (session?.type === 'morador') {
      const myUnit = units.find((u) => u.id === session.unitId);
      if (myUnit && myUnit.block === notification.block && myUnit.apartment === notification.apartment) {
        showToast('Essa é a sua encomenda! Veja os detalhes na aba "Para Retirar".', 'info');
        return;
      }
    }
    showToast('Notificação enviada ao morador via WhatsApp, E-mail e Push.', 'info');
  };

  // Reset to initial mock data (QA/demo) — desloga, já que a sessão atual pode
  // apontar pra uma unidade/cadastro que deixou de existir depois do reset.
  const handleResetData = () => {
    setUnits(ALL_UNITS);
    setPackages(INITIAL_PACKAGES);
    setLogs(INITIAL_LOGS);
    setMultichannelReports([]);
    localStorage.removeItem('village_azaleia_units');
    localStorage.removeItem('village_azaleia_packages');
    localStorage.removeItem('village_azaleia_logs');
    localStorage.removeItem('village_azaleia_multichannel_reports');
    localStorage.removeItem('village_azaleia_push_notifications');
    setSession(null);
    setPreAuthView('landing');
    showToast('Dados, unidades e encomendas restaurados para o padrão de demonstração!', 'success');
  };

  const handleMoradorAuthSuccess = (unit: Unit) => {
    setSession({ type: 'morador', unitId: unit.id });
    showToast(`Bem-vindo(a), ${unit.residentName}!`, 'success');
  };

  const handleStaffAuthSuccess = (staff: StaffAccount) => {
    setSession({ type: staff.role, staffId: staff.id });
    showToast(`Bem-vindo(a), ${staff.name}!`, 'success');
  };

  const handleSwitchRole = (targetRole: 'portaria' | 'morador' | 'totem' | 'sindico') => {
    if (targetRole === 'totem') {
      setTotemMode(true);
    } else if (targetRole === 'portaria') {
      setTotemMode(false);
      const portariaAccount = staffAccounts.find((s) => s.role === 'portaria') || { id: 'staff-portaria-1', name: 'Silvio Portaria', role: 'portaria' as const };
      setSession({ type: 'portaria', staffId: portariaAccount.id });
      showToast('Alternado para visão da Portaria', 'info');
    } else if (targetRole === 'sindico') {
      setTotemMode(false);
      const sindicoAccount = staffAccounts.find((s) => s.role === 'sindico') || { id: 'staff-sindico-1', name: 'Marcos Síndico', role: 'sindico' as const };
      setSession({ type: 'sindico', staffId: sindicoAccount.id });
      showToast('Alternado para visão do Síndico', 'info');
    } else if (targetRole === 'morador') {
      setTotemMode(false);
      const currentMoradorId = session?.type === 'morador' ? session.unitId : units[0]?.id || 'B03-A102';
      setSession({ type: 'morador', unitId: currentMoradorId });
      showToast('Alternado para PWA do Morador', 'info');
    }
  };

  const handleLogout = () => {
    setSession(null);
    setPreAuthView('landing');
  };

  const handleLandingSelect = (target: 'morador' | 'staff' | 'totem') => {
    if (target === 'totem') {
      setTotemMode(true);
    } else {
      setPreAuthView(target);
    }
  };

  const pendingCount = packages.filter((p) => p.status !== 'RETIRADA').length;

  const loggedInDisplayName = useMemo(() => {
    if (!session) return '';
    if (session.type === 'morador') {
      return units.find((u) => u.id === session.unitId)?.residentName || 'Morador';
    }
    return staffAccounts.find((s) => s.id === session.staffId)?.name || 'Equipe';
  }, [session, units, staffAccounts]);

  return (
    <>
      {totemMode ? (
        // Kiosk mode: Totem de Autoatendimento, sem autenticação (equipamento físico na portaria)
        <div className="min-h-screen bg-[#F8F9FA] text-[#1A2E22] flex flex-col font-sans antialiased">
          <div className="max-w-4xl mx-auto w-full px-4 pt-4">
            <button
              type="button"
              onClick={() => setTotemMode(false)}
              className="text-xs font-bold text-[#0D3823] hover:text-[#D81B60] flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          </div>
          <TotemView units={units} packages={packages} onAddPackage={handleAddPackage} onShowToast={showToast} />
        </div>
      ) : !session ? (
        // Not logged in: Landing → Morador (Entrar/Cadastrar) or Staff (Portaria/Síndico) login
        <>
          {preAuthView === 'landing' && <LandingScreen onSelect={handleLandingSelect} />}
          {preAuthView === 'morador' && (
            <MoradorAuthScreen
              units={units}
              onBack={() => setPreAuthView('landing')}
              onSaveUnit={handleUpdateUnit}
              onAuthSuccess={handleMoradorAuthSuccess}
              onShowToast={showToast}
            />
          )}
          {preAuthView === 'staff' && (
            <StaffLoginScreen
              staff={staffAccounts}
              onBack={() => setPreAuthView('landing')}
              onAuthSuccess={handleStaffAuthSuccess}
            />
          )}
        </>
      ) : (
        <div className="min-h-screen bg-[#F8F9FA] text-[#1A2E22] flex flex-col font-sans antialiased selection:bg-[#D81B60] selection:text-white">
          {/* 1. Global Push Notification Banner (Visible across ALL tabs & views) */}
          <PushNotificationBanner
            notification={activePushPopup}
            onDismiss={() => setActivePushPopup(null)}
            onOpenResidentApp={handleOpenResidentAppFromPush}
          />

          {/* 2. Logged-in Header (identidade da sessão + Sair) */}
          <AppHeader
            role={session.type}
            displayName={loggedInDisplayName}
            pendingCount={session.type === 'portaria' ? pendingCount : undefined}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onResetData={handleResetData}
            onLogout={handleLogout}
            onSwitchRole={handleSwitchRole}
          />

          {/* 3. Main Content Area according to the logged-in role */}
          <main className="flex-1 pb-16">
            {session.type === 'portaria' && (
              <PortariaView
                packages={packages}
                units={units}
                operatorName={loggedInDisplayName}
                onAddPackage={handleAddPackage}
                onPickupPackage={handlePickupPackage}
                onShowToast={showToast}
              />
            )}

            {session.type === 'morador' && (
              <MoradorView
                packages={packages}
                units={units}
                activeUnitId={session.unitId}
                onUpdateUnit={handleUpdateUnit}
                notifications={pushNotifications}
                multichannelReports={multichannelReports}
                onTriggerTestPush={handleTriggerTestPush}
                onShowToast={showToast}
              />
            )}

            {session.type === 'sindico' && (
              <SindicoDashboard
                packages={packages}
                logs={logs}
                units={units}
                onShowToast={showToast}
              />
            )}
          </main>
        </div>
      )}

      {/* Toast Notification Container — sempre visível, em qualquer tela (login incluso) */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-xl border backdrop-blur-md flex items-start justify-between gap-3 text-xs sm:text-sm animate-in slide-in-from-bottom-5 transition-all ${
              toast.type === 'success'
                ? 'bg-[#0D3823]/95 border-[#D4AF37]/50 text-white shadow-emerald-950/30'
                : toast.type === 'warning'
                ? 'bg-[#880E4F]/95 border-[#FFF2B2]/50 text-pink-50 shadow-pink-950/30'
                : 'bg-[#061D12]/95 border-[#D4AF37]/40 text-emerald-100 shadow-black/40'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-[#FF80AB] shrink-0 mt-0.5" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-[#FFF2B2] shrink-0 mt-0.5" />}
              <span className="font-medium leading-snug">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/60 hover:text-white p-0.5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
