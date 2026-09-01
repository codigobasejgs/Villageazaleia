import { supabase } from '../lib/supabase';
import { Unit, PackageItem, ActivityLog, MultichannelDispatchReport, PushNotification, StaffAccount } from '../types';

/**
 * Camada de dados do Supabase para o Condomínio Village Azaleia
 * Inclui tratamento de erros gracioso e fallback transparente para manter o app
 * 100% funcional mesmo em caso de falha transitória de rede.
 */

// ==========================================
// MAPPERS: CamelCase (App) <-> Snake_case (DB)
// ==========================================

export function mapUnitToDb(u: Unit) {
  return {
    id: u.id,
    block: String(u.block),
    apartment: Number(u.apartment),
    resident_name: u.residentName,
    resident_phone: u.residentPhone,
    resident_phones: u.residentPhones || [],
    resident_email: u.residentEmail,
    pwa_installed: u.pwaInstalled ?? false,
    push_enabled: u.pushEnabled ?? false,
    registered_at: u.registeredAt || new Date().toISOString(),
    lgpd_accepted: u.lgpdAccepted ?? false,
    lgpd_accepted_at: u.lgpdAcceptedAt || null,
    password_hash: u.passwordHash || null
  };
}

export function mapUnitFromDb(row: any): Unit {
  return {
    id: row.id,
    block: String(row.block),
    apartment: Number(row.apartment),
    residentName: row.resident_name,
    residentPhone: row.resident_phone,
    residentPhones: Array.isArray(row.resident_phones) ? row.resident_phones : [],
    residentEmail: row.resident_email,
    pwaInstalled: Boolean(row.pwa_installed),
    pushEnabled: Boolean(row.push_enabled),
    registeredAt: row.registered_at,
    lgpdAccepted: Boolean(row.lgpd_accepted),
    lgpdAcceptedAt: row.lgpd_accepted_at,
    passwordHash: row.password_hash || undefined
  };
}

export function mapPackageToDb(pkg: PackageItem) {
  return {
    id: pkg.id,
    tracking_code: pkg.trackingCode,
    unit_id: pkg.unitId || null,
    block: String(pkg.block),
    apartment: Number(pkg.apartment),
    resident_name: pkg.residentName,
    carrier: pkg.carrier,
    shelf: pkg.shelf,
    photo_url: pkg.photoUrl || null,
    notes: pkg.notes || null,
    status: pkg.status,
    received_at: pkg.receivedAt || new Date().toISOString(),
    stored_at: pkg.storedAt || null,
    picked_up_at: pkg.pickedUpAt || null,
    picked_up_by: pkg.pickedUpBy || null,
    operator_name: pkg.operatorName || null,
    qr_token: pkg.qrToken,
    registered_via: pkg.registeredVia || 'PORTARIA',
    delivery_guy_name: pkg.deliveryGuyName || null,
    dispatch_report_id: pkg.dispatchReportId || null,
    signature_url: pkg.signatureUrl || null,
    handover_photo_url: pkg.handoverPhotoUrl || null,
    receipt_protocol: pkg.receiptProtocol || null,
    receipt_url: pkg.receiptUrl || null,
    lgpd_accepted_at: pkg.lgpdAcceptedAt || null
  };
}

export function mapPackageFromDb(row: any): PackageItem {
  return {
    id: row.id,
    trackingCode: row.tracking_code,
    unitId: row.unit_id || undefined,
    block: String(row.block),
    apartment: Number(row.apartment),
    residentName: row.resident_name,
    carrier: row.carrier,
    shelf: row.shelf || { shelf: 'A', level: 1 },
    photoUrl: row.photo_url || '',
    notes: row.notes || undefined,
    status: row.status,
    receivedAt: row.received_at,
    storedAt: row.stored_at || undefined,
    pickedUpAt: row.picked_up_at || undefined,
    pickedUpBy: row.picked_up_by || undefined,
    operatorName: row.operator_name || undefined,
    qrToken: row.qr_token,
    registeredVia: row.registered_via || 'PORTARIA',
    deliveryGuyName: row.delivery_guy_name || undefined,
    dispatchReportId: row.dispatch_report_id || undefined,
    signatureUrl: row.signature_url || undefined,
    handoverPhotoUrl: row.handover_photo_url || undefined,
    receiptProtocol: row.receipt_protocol || undefined,
    receiptUrl: row.receipt_url || undefined,
    lgpdAcceptedAt: row.lgpd_accepted_at || undefined
  };
}

export function mapStaffFromDb(row: any): StaffAccount {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at
  };
}

export function mapLogToDb(log: ActivityLog) {
  return {
    id: log.id,
    timestamp: log.timestamp || new Date().toISOString(),
    package_id: log.packageId || null,
    tracking_code: log.trackingCode,
    unit_string: log.unitString,
    action: log.action,
    description: log.description,
    operator: log.operator,
    details: log.details || null
  };
}

export function mapLogFromDb(row: any): ActivityLog {
  return {
    id: row.id,
    timestamp: row.timestamp,
    packageId: row.package_id || '',
    trackingCode: row.tracking_code,
    unitString: row.unit_string,
    action: row.action,
    description: row.description,
    operator: row.operator,
    details: row.details || undefined
  };
}

// ==========================================
// DB SERVICE OPERATIONS
// ==========================================

export const dbService = {
  /**
   * UNITS (Moradores / Unidades)
   */
  async fetchUnits(): Promise<Unit[] | null> {
    try {
      const { data, error } = await supabase.from('units').select('*').order('block').order('apartment');
      if (error) {
        console.warn('[Supabase] fetchUnits warning:', error.message);
        return null;
      }
      return (data || []).map(mapUnitFromDb);
    } catch (err) {
      console.warn('[Supabase] fetchUnits exception:', err);
      return null;
    }
  },

  async upsertUnit(unit: Unit): Promise<boolean> {
    try {
      const { error } = await supabase.from('units').upsert(mapUnitToDb(unit), { onConflict: 'id' });
      if (error) {
        console.warn('[Supabase] upsertUnit error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[Supabase] upsertUnit exception:', err);
      return false;
    }
  },

  async seedUnits(units: Unit[]): Promise<boolean> {
    try {
      const payload = units.map(mapUnitToDb);
      const { error } = await supabase.from('units').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.warn('[Supabase] seedUnits error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[Supabase] seedUnits exception:', err);
      return false;
    }
  },

  /**
   * PACKAGES (Encomendas)
   */
  async fetchPackages(): Promise<PackageItem[] | null> {
    try {
      const { data, error } = await supabase.from('packages').select('*').order('received_at', { ascending: false });
      if (error) {
        console.warn('[Supabase] fetchPackages warning:', error.message);
        return null;
      }
      return (data || []).map(mapPackageFromDb);
    } catch (err) {
      console.warn('[Supabase] fetchPackages exception:', err);
      return null;
    }
  },

  async insertPackage(pkg: PackageItem): Promise<boolean> {
    try {
      const { error } = await supabase.from('packages').insert(mapPackageToDb(pkg));
      if (error) {
        console.warn('[Supabase] insertPackage error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[Supabase] insertPackage exception:', err);
      return false;
    }
  },

  async updatePackage(id: string, updates: Partial<PackageItem>): Promise<boolean> {
    try {
      const dbUpdates: any = {};
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.pickedUpAt !== undefined) dbUpdates.picked_up_at = updates.pickedUpAt;
      if (updates.pickedUpBy !== undefined) dbUpdates.picked_up_by = updates.pickedUpBy;
      if (updates.operatorName !== undefined) dbUpdates.operator_name = updates.operatorName;
      if (updates.signatureUrl !== undefined) dbUpdates.signature_url = updates.signatureUrl;
      if (updates.handoverPhotoUrl !== undefined) dbUpdates.handover_photo_url = updates.handoverPhotoUrl;
      if (updates.receiptProtocol !== undefined) dbUpdates.receipt_protocol = updates.receiptProtocol;
      if (updates.receiptUrl !== undefined) dbUpdates.receipt_url = updates.receiptUrl;
      if (updates.storedAt !== undefined) dbUpdates.stored_at = updates.storedAt;

      const { error } = await supabase.from('packages').update(dbUpdates).eq('id', id);
      if (error) {
        console.warn('[Supabase] updatePackage error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[Supabase] updatePackage exception:', err);
      return false;
    }
  },

  /**
   * STAFF (Portaria / Síndico)
   */
  async fetchStaffAccounts(): Promise<StaffAccount[] | null> {
    try {
      const { data, error } = await supabase.from('staff_accounts').select('*');
      if (error) {
        console.warn('[Supabase] fetchStaffAccounts warning:', error.message);
        return null;
      }
      return (data || []).map(mapStaffFromDb);
    } catch (err) {
      console.warn('[Supabase] fetchStaffAccounts exception:', err);
      return null;
    }
  },

  /**
   * AUDIT LOGS
   */
  async fetchLogs(): Promise<ActivityLog[] | null> {
    try {
      const { data, error } = await supabase.from('activity_logs').select('*').order('timestamp', { ascending: false });
      if (error) {
        console.warn('[Supabase] fetchLogs warning:', error.message);
        return null;
      }
      return (data || []).map(mapLogFromDb);
    } catch (err) {
      console.warn('[Supabase] fetchLogs exception:', err);
      return null;
    }
  },

  async insertLog(log: ActivityLog): Promise<boolean> {
    try {
      const { error } = await supabase.from('activity_logs').insert(mapLogToDb(log));
      if (error) {
        console.warn('[Supabase] insertLog error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[Supabase] insertLog exception:', err);
      return false;
    }
  },

  /**
   * REALTIME SUBSCRIPTIONS
   */
  subscribeAll(callbacks: {
    onPackageChange?: (payload: any) => void;
    onUnitChange?: (payload: any) => void;
    onLogChange?: (payload: any) => void;
  }) {
    const channel = supabase.channel('village_azaleia_realtime');

    if (callbacks.onPackageChange) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'packages' }, callbacks.onPackageChange);
    }
    if (callbacks.onUnitChange) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, callbacks.onUnitChange);
    }
    if (callbacks.onLogChange) {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, callbacks.onLogChange);
    }

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }
};
