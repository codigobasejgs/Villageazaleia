export type Carrier = 'Correios' | 'Mercado Livre' | 'Amazon' | 'Shopee' | 'Loggi' | 'Outra';

export type PackageStatus = 'RECEBIDA' | 'ARMAZENADA' | 'RETIRADA';

export type ShelfLetter = 'A' | 'B' | 'C';
export type ShelfLevel = 1 | 2 | 3 | 4;

export interface StorageLocation {
  shelf: ShelfLetter;
  level: ShelfLevel;
}

export interface ResidentPhoneContact {
  id: string;
  label: string; // 'Titular' | 'Cônjuge' | 'Filho(a)' | 'Familiar' | 'Outro'
  number: string;
  isWhatsapp: boolean;
}

export interface Unit {
  id: string; // e.g., "B03-A102" or "B12B-A102"
  block: string; // Ex: "3", "12B" — pode ter letra (torres/anexos)
  apartment: number; // 101, 102, 103, 104, 201, 202... 304
  residentName: string;
  residentPhone: string;
  residentPhones: ResidentPhoneContact[]; // Up to 5 phone/WhatsApp numbers
  residentEmail: string;
  pwaInstalled?: boolean;
  pushEnabled?: boolean;
  registeredAt?: string;
  lgpdAccepted?: boolean;
  lgpdAcceptedAt?: string;
  /** Hash da senha de login do morador (ver src/services/auth.service.ts). */
  passwordHash?: string;
}

export type StaffRole = 'portaria' | 'sindico';

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: StaffRole;
  createdAt: string;
}

export type AuthSession =
  | { type: 'morador'; unitId: string }
  | { type: StaffRole; staffId: string };

export interface PackageItem {
  id: string;
  trackingCode: string;
  unitId: string;
  block: string;
  apartment: number;
  residentName: string;
  carrier: Carrier;
  shelf: StorageLocation;
  photoUrl: string;
  notes?: string;
  status: PackageStatus;
  receivedAt: string; // ISO date string
  storedAt?: string;
  pickedUpAt?: string;
  pickedUpBy?: string;
  operatorName?: string;
  qrToken: string;
  registeredVia: 'PORTARIA' | 'TOTEM_ENTREGADOR';
  deliveryGuyName?: string;
  dispatchReportId?: string;
  signatureUrl?: string; // Digital signature base64 data
  handoverPhotoUrl?: string; // Handover photo snapshot
  receiptProtocol?: string; // e.g., "REC-VA-20260829-9281"
  receiptUrl?: string;
  lgpdAcceptedAt?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  packageId: string;
  trackingCode: string;
  unitString: string;
  action: 'ENTRADA' | 'ARMAZENAMENTO' | 'RETIRADA' | 'TOTEM_REGISTRO' | 'NOTIFICACAO_MULTICANAL' | 'CADASTRO_LGPD' | 'RECIBO_EMITIDO';
  description: string;
  operator: string;
  details?: string;
}

export type AppRole = 'portaria' | 'morador' | 'totem' | 'sindico';

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  packageId: string;
  block: string;
  apartment: number;
  residentName: string;
  carrier: Carrier;
  trackingCode: string;
  shelfString: string;
  timestamp: string;
  read: boolean;
}

export interface AuditFilterParams {
  searchTerm: string;
  carrier: string;
  block: string;
  apartment: string;
  status: 'ALL' | PackageStatus;
  dateType: 'ENTRADA' | 'RETIRADA';
  startDate: string;
  endDate: string;
}

export interface WhatsappDispatchStatus {
  status: 'SENT' | 'SIMULATED' | 'FAILED';
  recipientName: string;
  label: string;
  phone: string;
  deliveredAt: string;
  messagePreview: string;
}

export interface EmailDispatchStatus {
  status: 'SENT' | 'SIMULATED' | 'FAILED';
  recipientEmail: string;
  recipientName: string;
  subject: string;
  deliveredAt: string;
  htmlPreview: string;
}

export interface WebPushDispatchStatus {
  status: 'SENT' | 'SIMULATED' | 'FAILED';
  title: string;
  body: string;
  deliveredAt: string;
}

export interface MultichannelDispatchReport {
  id: string;
  packageId: string;
  trackingCode: string;
  unitString: string;
  residentName: string;
  carrier: Carrier;
  timestamp: string;
  whatsappDispatches: WhatsappDispatchStatus[];
  emailDispatch: EmailDispatchStatus;
  webPushDispatch: WebPushDispatchStatus;
}
