import { PackageItem, Unit, MultichannelDispatchReport } from '../../types';
import { evolutionService } from './evolution-whatsapp';
import { resendService } from './resend-email';
import { webPushService } from './web-push';

export class MultichannelNotificationService {
  /**
   * Dispatches notifications across all 3 channels simultaneously:
   * 1. WhatsApp (Evolution API) to up to 5 registered contacts
   * 2. Branded HTML Email (Resend API)
   * 3. Native & In-App Web Push Notification (PWA)
   */
  public async dispatchAll(pkg: PackageItem, unit: Unit): Promise<MultichannelDispatchReport> {
    const reportId = `report-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Execute all 3 in parallel
    const [whatsappDispatches, emailDispatch, webPushDispatch] = await Promise.all([
      evolutionService.dispatchToUnit(pkg, unit),
      resendService.sendParcelNotification(pkg, unit),
      webPushService.dispatchWebPush(pkg, unit)
    ]);

    const report: MultichannelDispatchReport = {
      id: reportId,
      packageId: pkg.id,
      trackingCode: pkg.trackingCode,
      unitString: `Bloco ${pkg.block} - Apt ${pkg.apartment}`,
      residentName: unit.residentName,
      carrier: pkg.carrier,
      timestamp: new Date().toISOString(),
      whatsappDispatches,
      emailDispatch,
      webPushDispatch
    };

    return report;
  }

  /**
   * Dispatches Welcome message + LGPD confirmation via Resend Email only.
   * O WhatsApp real (Evolution API) dispara SOMENTE "encomenda chegou" e "encomenda retirada" —
   * decisão explícita do dono do sistema, pra não gastar a conexão do número com boas-vindas.
   */
  public async dispatchWelcomeRegistration(unit: Unit) {
    const emailDispatch = await resendService.sendWelcomeEmail(unit);

    return {
      unitId: unit.id,
      timestamp: new Date().toISOString(),
      emailDispatch
    };
  }

  /**
   * Dispatches Digital Delivery Receipt via Evolution WhatsApp and Resend Email
   */
  public async dispatchDeliveryReceipt(pkg: PackageItem, unit: Unit) {
    const [whatsappDispatches, emailDispatch] = await Promise.all([
      evolutionService.dispatchReceiptToUnit(pkg, unit),
      resendService.sendDeliveryReceiptEmail(pkg, unit)
    ]);

    return {
      packageId: pkg.id,
      protocol: pkg.receiptProtocol,
      timestamp: new Date().toISOString(),
      whatsappDispatches,
      emailDispatch
    };
  }
}

export const multichannelService = new MultichannelNotificationService();
export { evolutionService } from './evolution-whatsapp';
export { resendService } from './resend-email';
export { webPushService } from './web-push';
