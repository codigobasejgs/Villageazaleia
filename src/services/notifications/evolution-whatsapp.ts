import { PackageItem, Unit, WhatsappDispatchStatus } from '../../types';
import { supabase } from '../../lib/supabase';

/**
 * Cliente WhatsApp do Village Azaleia.
 *
 * IMPORTANTE: o envio real acontece em /api/whatsapp/send (função serverless) —
 * a apikey da Evolution API NUNCA fica no navegador. Este serviço só monta o texto
 * da mensagem e chama nosso próprio backend, que repassa pra Evolution API.
 * Ver: api/whatsapp/send.ts, api/whatsapp/status.ts, api/whatsapp/connect.ts.
 */
export class EvolutionWhatsAppService {
  /**
   * Builds the formatted WhatsApp message text with Village Azaleia template
   */
  public buildMessageText(pkg: PackageItem, recipientName: string): string {
    const formattedTime = new Date(pkg.receivedAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const formattedDate = new Date(pkg.receivedAt).toLocaleDateString('pt-BR');
    // Link sem ?role= (BUG-002) — o app exige login normal
    const pwaAppUrl = typeof window !== 'undefined' ? window.location.origin : 'https://villageazaleia.vercel.app';

    return (
      `🌿 *CONDOMÍNIO RESIDENCIAL VILLAGE AZALEIA*\n` +
      `📦 *Aviso de Chegada de Encomenda*\n\n` +
      `Olá, *${recipientName}*! Sua encomenda foi recebida na Portaria do Village Azaleia.\n\n` +
      `🏢 *Unidade:* Bloco ${pkg.block} - Apt ${pkg.apartment}\n` +
      `📦 *Transportadora:* ${pkg.carrier}\n` +
      `🔢 *Código/Rastreio:* ${pkg.trackingCode}\n` +
      `📍 *Local de guarda:* Estante ${pkg.shelf.shelf} - Prateleira ${pkg.shelf.level}\n` +
      `🕒 *Horário:* ${formattedDate} às ${formattedTime}\n` +
      (pkg.notes ? `📝 *Observação:* ${pkg.notes}\n` : '') +
      `\n📲 *Acesse o app para visualizar a foto e gerar seu QR Code de retirada:*\n` +
      `${pwaAppUrl}\n\n` +
      `_Apresente seu QR Code na portaria central para liberação rápida e segura._`
    );
  }

  /**
   * Envia um texto pra um número via nosso backend seguro (/api/whatsapp/send).
   * Nunca lança — retorna status SENT/SIMULATED/FAILED, pra não travar o fluxo do app.
   */
  private async sendViaBackend(phone: string, text: string): Promise<'SENT' | 'FAILED'> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';

      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ phone, text })
      });
      if (!response.ok) return 'FAILED';
      const data = await response.json();
      return data.status === 'SENT' ? 'SENT' : 'FAILED';
    } catch (err) {
      console.warn('[WhatsApp] Falha ao chamar /api/whatsapp/send:', err);
      return 'FAILED';
    }
  }

  /**
   * Dispatches "encomenda chegou" messages to all registered phone numbers for the unit (up to 5 numbers)
   */
  public async dispatchToUnit(pkg: PackageItem, unit: Unit): Promise<WhatsappDispatchStatus[]> {
    const rawContacts = unit.residentPhones && unit.residentPhones.length > 0
      ? unit.residentPhones
      : (unit.residentPhone ? [{ id: 'default-1', label: 'Titular', number: unit.residentPhone, isWhatsapp: true }] : []);

    // Filtra placeholders e numeros vazios (BUG-012)
    const contacts = rawContacts.filter((c) => {
      const clean = (c.number || '').replace(/\D/g, '');
      return clean.length >= 10 && !clean.includes('999990000') && !clean.endsWith('00000000');
    });

    if (contacts.length === 0) return [];

    const results: WhatsappDispatchStatus[] = [];

    for (const contact of contacts) {
      const recipientName = contact.label === 'Titular'
        ? unit.residentName
        : `${unit.residentName} (${contact.label})`;

      const messageText = this.buildMessageText(pkg, recipientName);
      const status = await this.sendViaBackend(contact.number, messageText);

      results.push({
        status,
        recipientName,
        label: contact.label,
        phone: contact.number,
        deliveredAt: new Date().toISOString(),
        messagePreview: messageText
      });
    }

    return results;
  }

  /**
   * Dispatches "encomenda retirada" (comprovante de entrega) message to all registered unit phones
   */
  public async dispatchReceiptToUnit(pkg: PackageItem, unit: Unit): Promise<WhatsappDispatchStatus[]> {
    const rawContacts = unit.residentPhones && unit.residentPhones.length > 0
      ? unit.residentPhones
      : (unit.residentPhone ? [{ id: 'default-1', label: 'Titular', number: unit.residentPhone, isWhatsapp: true }] : []);

    const contacts = rawContacts.filter((c) => {
      const clean = (c.number || '').replace(/\D/g, '');
      return clean.length >= 10 && !clean.includes('999990000') && !clean.endsWith('00000000');
    });

    if (contacts.length === 0) return [];

    const protocol = pkg.receiptProtocol || `REC-VA-${pkg.id.replace(/\D/g, '').slice(-8) || '20260829'}`;
    const pickupDate = pkg.pickedUpAt ? new Date(pkg.pickedUpAt) : new Date();
    const formattedTime = pickupDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = pickupDate.toLocaleDateString('pt-BR');
    const pwaAppUrl = typeof window !== 'undefined' ? window.location.origin : 'https://villageazaleia.vercel.app';

    const results: WhatsappDispatchStatus[] = [];

    for (const contact of contacts) {
      const recipientName = contact.label === 'Titular'
        ? unit.residentName
        : `${unit.residentName} (${contact.label})`;

      const messageText =
        `🌿 *CONDOMÍNIO RESIDENCIAL VILLAGE AZALEIA*\n` +
        `🧾 *COMPROVANTE OFICIAL DE RETIRADA DE ENCOMENDA*\n\n` +
        `Olá, *${recipientName}*! Confirmamos que sua encomenda foi entregue e baixada com sucesso.\n\n` +
        `📋 *Protocolo:* ${protocol}\n` +
        `🏢 *Unidade:* Bloco ${pkg.block} - Apt ${pkg.apartment}\n` +
        `📦 *Transportadora:* ${pkg.carrier}\n` +
        `🔢 *Código:* ${pkg.trackingCode}\n` +
        `👤 *Retirado por:* ${pkg.pickedUpBy || pkg.residentName}\n` +
        `🕒 *Data/Hora:* ${formattedDate} às ${formattedTime}\n` +
        `✍️ *Assinatura Digital:* Registrada com validade jurídica (MP 2.200-2/2001)\n\n` +
        `📲 *Visualize ou baixe o recibo com foto e assinatura em seu app:*\n` +
        `${pwaAppUrl}\n\n` +
        `_Village Azaleia • Segurança e Transparência em cada entrega._`;

      const status = await this.sendViaBackend(contact.number, messageText);

      results.push({
        status,
        recipientName,
        label: contact.label,
        phone: contact.number,
        deliveredAt: new Date().toISOString(),
        messagePreview: messageText
      });
    }

    return results;
  }
}

export const evolutionService = new EvolutionWhatsAppService();
