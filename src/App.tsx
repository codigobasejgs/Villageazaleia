/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { PackageItem, ActivityLog, AuthSession, Unit, PushNotification, MultichannelDispatchReport } from './types';
import * as authService from './services/auth.service';
import { dbService } from './services/db.service';
import { AppShell } from './components/layout/AppShell';
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
  // 1. Sessão autenticada (null = ninguém logado). Hidratada do JWT do Supabase
  //    no efeito de sincronização — nunca de localStorage nem de parâmetro de URL.
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authCarregando, setAuthCarregando] = useState(true);
  const [preAuthView, setPreAuthView] = useState<PreAuthView>('landing');
  const [totemMode, setTotemMode] = useState(false);

  // Falha de conexão com o banco: precisa ser visível, não engolida (BUG-004).
  const [erroConexao, setErroConexao] = useState<string | null>(null);

  // 2. Unidades — só o que vier do banco. Nada de cache local com dado pessoal
  //    de morador, e nada de seed fictício exibido como se fosse real.
  const [units, setUnits] = useState<Unit[]>([]);

  // 4. Sound state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('village_azaleia_sound');
    return saved !== null ? saved === 'true' : true;
  });

  // 5. Encomendas — exclusivamente do banco. O fallback anterior para
  //    INITIAL_PACKAGES fazia 7 encomendas fictícias entrarem nos KPIs e no CSV
  //    como se fossem reais quando o Supabase falhava (BUG-004).
  const [packages, setPackages] = useState<PackageItem[]>([]);

  // 6. Trilha de auditoria — só do banco.
  const [logs, setLogs] = useState<ActivityLog[]>([]);

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
    // Só busca dados depois que houver sessão — a RLS recusa requisição anônima,
    // e insistir sem login só produziria erro de conexão falso na tela.
    if (!session) return;

    async function initSupabaseData() {
      const [remoteUnits, remotePackages, remoteLogs] = await Promise.all([
        dbService.fetchUnits(),
        dbService.fetchPackages(),
        dbService.fetchLogs()
      ]);

      // Falha é comunicada, não engolida (BUG-004). Sem isso, banco fora do ar
      // fica indistinguível de "condomínio sem nenhuma encomenda hoje".
      if (remoteUnits === null || remotePackages === null) {
        setErroConexao('Sem conexão com o servidor. Os dados exibidos podem estar desatualizados e novos registros não serão salvos.');
        return;
      }

      setErroConexao(null);
      setUnits(remoteUnits);
      setPackages(remotePackages);
      if (remoteLogs) setLogs(remoteLogs);
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
  }, [session]);

  // 10. Sessão: vem SEMPRE do JWT do Supabase, nunca da URL.
  //
  // O bloco anterior lia "?role=sindico" e concedia a sessão sem credencial
  // nenhuma (BUG-002 da auditoria) — bypass completo de autenticação, e o link
  // ia dentro de toda mensagem de WhatsApp/e-mail enviada ao morador. Removido.
  //
  // O único parâmetro que sobrevive é "?totem=1", que apenas escolhe o layout do
  // quiosque: ele não concede leitura de dado nenhum, porque a RLS exige uma
  // sessão autenticada de qualquer forma.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('totem') === '1') {
      setTotemMode(true);
    }
  }, []);

  // Hidrata a sessão a partir do Supabase e reage a expiração/refresh do token.
  useEffect(() => {
    let ativo = true;

    const sincronizar = async () => {
      const s = await authService.getSession();
      if (ativo) setSession(s);
    };

    sincronizar();
    const cancelar = authService.onAuthChange(sincronizar);
    return () => {
      ativo = false;
      cancelar();
    };
  }, []);

  // Sync sound engine
  useEffect(() => {
    sound.setEnabled(soundEnabled);
    localStorage.setItem('village_azaleia_sound', String(soundEnabled));
  }, [soundEnabled]);

  // Sem espelho de dados pessoais em localStorage.
  //
  // As cópias anteriores (units, staff, packages, logs) colocavam no disco do
  // navegador o nome, telefone, e-mail e hash de senha de todos os moradores,
  // além dos hashes das contas da equipe — legíveis por qualquer script na
  // página e persistentes após o logout. O banco é a fonte de verdade; o que
  // some no refresh é recarregado com a sessão autenticada.
  //
  // Só preferência de interface continua local:
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
    // ID e QR token criptograficamente seguros (BUG-005 / BUG-016).
    // O token anterior usava Date.now(), previsivel em ~16 minutos e colidia.
    const newId = `pkg-${crypto.randomUUID()}`;
    const tokenRandom = crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
    const qrToken = `VA-${tokenRandom}`;

    const newPackage: PackageItem = {
      ...pkgData,
      id: newId,
      status: 'ARMAZENADA',
      receivedAt: new Date().toISOString(),
      qrToken,
      registeredVia: pkgData.registeredVia || 'PORTARIA'
    };

    // Push no banco COM AWAIT (BUG-004) — o anterior era fire-and-forget e
    // engolia erro, mantendo o pacote na tela quando o banco falhava.
    const ok = await dbService.insertPackage(newPackage);
    if (!ok) {
      showToast('Falha ao salvar a encomenda no servidor. Verifique a conexao.', 'warning');
      return;
    }

    // So adiciona ao state se o banco aceitou
    setPackages((prev) => [newPackage, ...prev]);

    const newLog: ActivityLog = {
      id: `log-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      packageId: newId,
      trackingCode: newPackage.trackingCode,
      unitString: `Bloco ${newPackage.block} - Apt ${newPackage.apartment}`,
      action: pkgData.registeredVia === 'TOTEM_ENTREGADOR' ? 'TOTEM_REGISTRO' : 'ENTRADA',
      description: `Encomenda ${newPackage.carrier} registrada e armazenada na Estante ${newPackage.shelf.shelf}${newPackage.shelf.level}`,
      operator: newPackage.operatorName || 'Portaria Central'
    };

    setLogs((prev) => [newLog, ...prev]);
    await dbService.insertLog(newLog);

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
    const targetPkg = packages.find((p) => p.id === pkgId);
    if (!targetPkg) return;

    if (!signatureUrl) {
      showToast('Assinatura digital e obrigatoria para a baixa.', 'warning');
      return;
    }

    const protocol = receiptProtocol || `REC-VA-${Date.now().toString().slice(-8)}`;

    // Chamada atomica no banco (BUG-003 da auditoria).
    // O Postgres executa SELECT FOR UPDATE + compare-and-swap e garante que se
    // dois porteiros confirmarem ao mesmo tempo, um conclui e o outro recebe
    // erro explicito — a assinatura do primeiro NUNCA e destruida.
    const res = await dbService.confirmarRetiradaAtomic({
      packageId: pkgId,
      // targetPkg.qrToken e o valor real desta encomenda no banco — enviar sempre,
      // independente de o porteiro ter achado por QR, rastreio ou clique na lista.
      // Sem isso a checagem de "QR ja consumido/expirado" na RPC nunca executava.
      qrToken: targetPkg.qrToken,
      pickedUpBy: pickedUpBy || targetPkg.residentName,
      signatureUrl,
      handoverPhotoUrl,
      receiptProtocol: protocol
    });

    if (!res.ok) {
      showToast(res.error || 'Nao foi possivel dar baixa na encomenda.', 'warning');
      // Sincroniza o estado local com a realidade do banco
      const refreshed = await dbService.fetchPackages();
      if (refreshed) setPackages(refreshed);
      return;
    }

    const updatedPackage = res.package || {
      ...targetPkg,
      status: 'RETIRADA' as const,
      pickedUpAt: new Date().toISOString(),
      pickedUpBy: pickedUpBy || targetPkg.residentName,
      operatorName: operatorName || targetPkg.operatorName,
      signatureUrl: signatureUrl || undefined,
      handoverPhotoUrl: handoverPhotoUrl || undefined,
      receiptProtocol: protocol
    };

    // Atualiza o state local apos confirmacao do banco (nunca otimista cego)
    setPackages((prev) => prev.map((p) => (p.id === pkgId ? updatedPackage : p)));

    // Audit Log 2: RECIBO_EMITIDO (o log de RETIRADA ja e gravado pela RPC no banco)
    const receiptLog: ActivityLog = {
      id: `log-rec-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      packageId: pkgId,
      trackingCode: targetPkg.trackingCode,
      unitString: `Bloco ${targetPkg.block} - Apt ${targetPkg.apartment}`,
      action: 'RECIBO_EMITIDO',
      description: `Recibo Digital emitido sob protocolo ${protocol}`,
      operator: 'Sistema de Protocolo Digital'
    };

    setLogs((prev) => [receiptLog, ...prev]);
    await dbService.insertLog(receiptLog);

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

  // Update / Register a unit profile.
  // skipDbSync=true quando a unidade ja foi criada no banco por outra via
  // (ex: /api/units/claim no cadastro) — evita um upsert redundante que a
  // RLS nova rejeitaria mesmo (morador so tem policy de UPDATE, nao INSERT).
  const handleUpdateUnit = (updatedUnit: Unit, skipDbSync = false) => {
    setUnits((prev) => {
      const exists = prev.some((u) => u.id === updatedUnit.id || (String(u.block) === String(updatedUnit.block) && u.apartment === updatedUnit.apartment));
      if (exists) {
        return prev.map((u) => (u.id === updatedUnit.id || (String(u.block) === String(updatedUnit.block) && u.apartment === updatedUnit.apartment) ? updatedUnit : u));
      }
      return [updatedUnit, ...prev];
    });

    if (!skipDbSync) {
      dbService.upsertUnit(updatedUnit);
    }
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

  // Após o login o Supabase emite o JWT e onAuthChange sincroniza a sessão —
  // estas funções só dão o feedback e nunca mais fabricam a sessão na mão.
  const handleMoradorAuthSuccess = (nome: string) => {
    showToast(`Bem-vindo(a), ${nome}!`, 'success');
  };

  const handleStaffAuthSuccess = (nome: string) => {
    showToast(`Bem-vindo(a), ${nome}!`, 'success');
  };

  const handleLogout = async () => {
    await authService.clearSession();
    setSession(null);
    setUnits([]);
    setPackages([]);
    setLogs([]);
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
    return session.type === 'sindico' ? 'Síndico' : 'Portaria';
  }, [session, units]);

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
              onBack={() => setPreAuthView('landing')}
              onSaveUnit={handleUpdateUnit}
              onAuthSuccess={handleMoradorAuthSuccess}
              onShowToast={showToast}
            />
          )}
          {preAuthView === 'staff' && (
            <StaffLoginScreen
              onBack={() => setPreAuthView('landing')}
              onAuthSuccess={handleStaffAuthSuccess}
            />
          )}
        </>
      ) : (
        <AppShell
          role={session.type}
          displayName={loggedInDisplayName}
          pendingCount={session.type === 'portaria' ? pendingCount : undefined}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          onLogout={handleLogout}
        >
          {/* Global Push Notification Banner (Visible across ALL tabs & views) */}
          <PushNotificationBanner
            notification={activePushPopup}
            onDismiss={() => setActivePushPopup(null)}
            onOpenResidentApp={handleOpenResidentAppFromPush}
          />

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
              units={units}
              onShowToast={showToast}
            />
          )}
        </AppShell>
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
