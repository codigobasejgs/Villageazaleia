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
import { dbService } from './services/db.service';
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

  // 2. Units state com cache local inicial e sync Supabase
  const [units, setUnits] = useState<Unit[]>(() => {
    try {
      const saved = localStorage.getItem('village_azaleia_units');
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return ALL_UNITS;
  });

  // 3. Staff accounts (Portaria/Síndico)
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>(() => {
    try {
      const saved = localStorage.getItem('village_azaleia_staff');
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return [];
  });

  // 4. Sound state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('village_azaleia_sound');
    return saved !== null ? saved === 'true' : true;
  });

  // 5. Packages state com cache local inicial e sync Supabase
  const [packages, setPackages] = useState<PackageItem[]>(() => {
    try {
      const saved = localStorage.getItem('village_azaleia_packages');
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return INITIAL_PACKAGES;
  });

  // 6. Activity logs state com cache local e sync Supabase
  const [logs, setLogs] = useState<ActivityLog[]>(() => {
    try {
      const saved = localStorage.getItem('village_azaleia_logs');
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return INITIAL_LOGS;
  });

  // 7. Multichannel Dispatch Reports
  const [multichannelReports, setMultichannelReports] = useState<MultichannelDispatchReport[]>(() => {
    try {
      const saved = localStorage.getItem('village_azaleia_multichannel_reports');
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return [];
  });

  // 8. Push notifications state
  const [pushNotifications, setPushNotifications] = useState<PushNotification[]>(() => {
    try {
      const saved = localStorage.getItem('village_azaleia_push_notifications');
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return [
      {
        id: 'notif-initial-1',
        title: 'Nova encomenda recebida para sua unidade!',
        body: 'Morador(a) Beatriz Lima, seu pacote da Amazon (AMZ-BR-49201948) foi guardado na Estante A1. Apresente seu QR Code na Portaria.',
        packageId: 'pkg-1',
        block: '3',
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

  // =========================================================================
  // SUPABASE REALTIME & INITIAL FETCH
  // =========================================================================
  useEffect(() => {
    // 1. Fetch initial remote data from Supabase
    async function initSupabaseData() {
      // Fetch Units (inicia com os cadastrados no banco)
      const remoteUnits = await dbService.fetchUnits();
      if (remoteUnits) {
        setUnits(remoteUnits);
      }

      // Fetch Staff
      const remoteStaff = await dbService.fetchStaffAccounts();
      if (remoteStaff && remoteStaff.length > 0) {
        setStaffAccounts(remoteStaff);
      } else {
        const seedStaff = await generateSeedStaffAccounts();
        setStaffAccounts(seedStaff);
      }

      // Fetch Packages
      const remotePackages = await dbService.fetchPackages();
      if (remotePackages) {
        setPackages(remotePackages);
      }

      // Fetch Logs
      const remoteLogs = await dbService.fetchLogs();
      if (remoteLogs) {
        setLogs(remoteLogs);
      }
    }

    initSupabaseData();

    // 2. Realtime Subscriptions (Sync across devices)
    const unsubscribe = dbService.subscribeAll({
      onPackageChange: async () => {
        const refreshed = await dbService.fetchPackages();
        if (refreshed) setPackages(refreshed);
      },
      onUnitChange: async () => {
        const refreshed = await dbService.fetchUnits();
        if (refreshed) setUnits(refreshed);
      },
      onLogChange: async () => {
        const refreshed = await dbService.fetchLogs();
        if (refreshed) setLogs(refreshed);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

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

  // Local storage backups
  useEffect(() => {
    localStorage.setItem('village_azaleia_units', JSON.stringify(units));
  }, [units]);

  useEffect(() => {
    if (staffAccounts.length > 0) {
      localStorage.setItem('village_azaleia_staff', JSON.stringify(staffAccounts));
    }
  }, [staffAccounts]);

  useEffect(() => {
    localStorage.setItem('village_azaleia_packages', JSON.stringify(packages));
  }, [packages]);

  useEffect(() => {
    localStorage.setItem('village_azaleia_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('village_azaleia_multichannel_reports', JSON.stringify(multichannelReports));
  }, [multichannelReports]);

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

  // PWA build update notification
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

  // Add new package (Portaria or Totem) & Trigger Supabase Insert + Multichannel Notifications
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

    // Optimistic state update
    setPackages((prev) => [newPackage, ...prev]);

    // Create log entry
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

    // Push to Supabase Cloud DB
    dbService.insertPackage(newPackage);
    dbService.insertLog(newLog);

    // Push Notification Banner UI
    triggerPushNotification(newPackage);

    // Target Unit lookup for Multichannel dispatch (WhatsApp + Resend + Web Push).
    // IMPORTANTE: só dispara pra um morador com contato REAL cadastrado — nunca inventa
    // telefone/e-mail falso pra "fingir" que enviou (isso não chegava em lugar nenhum).
    const targetUnit = units.find((u) => String(u.block) === String(newPackage.block) && u.apartment === newPackage.apartment);

    if (!targetUnit) {
      const noContactLog: ActivityLog = {
        id: `log-notif-${Date.now()}`,
        timestamp: new Date().toISOString(),
        packageId: newId,
        trackingCode: newPackage.trackingCode,
        unitString: `Bloco ${newPackage.block} - Apt ${newPackage.apartment}`,
        action: 'NOTIFICACAO_MULTICANAL',
        description: 'Morador ainda não tem cadastro (WhatsApp/e-mail) — nenhum disparo automático foi enviado. Avise manualmente.',
        operator: 'Sistema Multicanal Village Azaleia'
      };
      setLogs((prev) => [noContactLog, ...prev]);
      dbService.insertLog(noContactLog);
      showToast(
        `Encomenda registrada para Bloco ${newPackage.block} Apt ${newPackage.apartment}, mas o morador ainda não tem WhatsApp/e-mail cadastrado. Avise manualmente!`,
        'warning'
      );
      return;
    }

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
      dbService.insertLog(multichannelLog);
    } catch (err) {
      console.warn('[Multichannel Dispatch Error]', err);
    }
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

    // Optimistic update
    setPackages((prev) =>
      prev.map((p) => (p.id === pkgId ? updatedPackage : p))
    );

    // Save to Supabase DB
    dbService.updatePackage(pkgId, {
      status: 'RETIRADA',
      pickedUpAt: now,
      pickedUpBy: pickedUpBy || targetPkg.residentName,
      operatorName: operatorName || targetPkg.operatorName,
      signatureUrl: signatureUrl || null,
      handoverPhotoUrl: handoverPhotoUrl || null,
      receiptProtocol: protocol
    });

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
    dbService.insertLog(newLog);
    dbService.insertLog(receiptLog);

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

    // Lookup unit to dispatch delivery receipt via WhatsApp and Email.
    // Mesma regra: só dispara pra contato real cadastrado, nunca inventa telefone/e-mail falso.
    const targetUnit = units.find((u) => String(u.block) === String(targetPkg.block) && u.apartment === targetPkg.apartment);

    if (!targetUnit) {
      showToast(
        `Baixa confirmada, mas o morador do Bloco ${targetPkg.block} Apt ${targetPkg.apartment} ainda não tem WhatsApp/e-mail cadastrado — recibo não pôde ser enviado automaticamente.`,
        'warning'
      );
      return;
    }

    try {
      const receiptReport = await multichannelService.dispatchDeliveryReceipt(updatedPackage, targetUnit);
      setMultichannelReports((prev) => [receiptReport, ...prev]);
    } catch (e) {
      console.warn('[Receipt dispatch error]', e);
    }
  };

  // Update / Register a unit profile
  const handleUpdateUnit = (updatedUnit: Unit) => {
    setUnits((prev) => {
      const exists = prev.some((u) => u.id === updatedUnit.id || (String(u.block) === String(updatedUnit.block) && u.apartment === updatedUnit.apartment));
      if (exists) {
        return prev.map((u) => (u.id === updatedUnit.id || (String(u.block) === String(updatedUnit.block) && u.apartment === updatedUnit.apartment) ? updatedUnit : u));
      }
      return [updatedUnit, ...prev];
    });
    setSession({ type: 'morador', unitId: updatedUnit.id });

    // Sync to Supabase Cloud DB
    dbService.upsertUnit(updatedUnit);
  };

  // Push Notification Banner click
  const handleOpenResidentAppFromPush = (notification: PushNotification) => {
    setActivePushPopup(null);
    if (session?.type === 'morador') {
      const myUnit = units.find((u) => u.id === session.unitId);
      if (myUnit && String(myUnit.block) === String(notification.block) && myUnit.apartment === notification.apartment) {
        showToast('Essa é a sua encomenda! Veja os detalhes na aba "Para Retirar".', 'info');
        return;
      }
    }
    showToast('Notificação enviada ao morador via WhatsApp, E-mail e Push.', 'info');
  };

  const handleMoradorAuthSuccess = (unit: Unit) => {
    setSession({ type: 'morador', unitId: unit.id });
    showToast(`Bem-vindo(a), ${unit.residentName}!`, 'success');
  };

  const handleStaffAuthSuccess = (staff: StaffAccount) => {
    setSession({ type: staff.role, staffId: staff.id });
    showToast(`Bem-vindo(a), ${staff.name}!`, 'success');
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
            onLogout={handleLogout}
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

      {/* Toast Notification Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-2xl shadow-xl border flex items-center gap-3 pointer-events-auto transform transition-all duration-300 animate-in slide-in-from-bottom-5 text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-[#061D12] text-white border-[#D4AF37] ring-1 ring-[#D4AF37]/50'
                : toast.type === 'warning'
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-[#0D3823] text-white border-[#D4AF37]/40'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-[#FFF2B2] shrink-0" />}
            <span className="flex-1 leading-snug">{toast.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}
