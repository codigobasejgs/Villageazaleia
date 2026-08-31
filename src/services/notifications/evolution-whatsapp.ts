import { PackageItem, Unit, WhatsappDispatchStatus } from '../../types';

export interface EvolutionApiConfig {
  apiUrl?: string;
  apiKey?: string;
  instanceName?: string;
}

export class EvolutionWhatsAppService {
  private config: EvolutionApiConfig;

  constructor(config: EvolutionApiConfig = {}) {
    const metaEnv = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};
    this.config = {
      apiUrl: config.apiUrl || (metaEnv.VITE_EVOLUTION_API_URL as string) || 'https://api.evolution-api.com',
      apiKey: config.apiKey || (metaEnv.VITE_EVOLUTION_API_KEY as string) || '',
      instanceName: config.instanceName || (metaEnv.VITE_EVOLUTION_INSTANCE as string) || 'village-azaleia-portaria'
    };
  }

  /**
   * Builds the formatted WhatsApp message text with Village Azaleia template
   */
  public buildMessageText(pkg: PackageItem, recipientName: string): string {
    const formattedTime = new Date(pkg.receivedAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const formattedDate = new Date(pkg.receivedAt).toLocaleDateString('pt-BR');
    const pwaAppUrl = typeof window !== 'undefined' ? `${window.location.origin}?unit=${pkg.unitId}&role=morador` : 'https://village-azaleia.app';

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
   * Dispatches WhatsApp messages to all registered phone numbers for the unit (up to 5 numbers)
   */
  public async dispatchToUnit(pkg: PackageItem, unit: Unit): Promise<WhatsappDispatchStatus[]> {
    const contacts = unit.residentPhones && unit.residentPhones.length > 0
      ? unit.residentPhones
      : [
          {
            id: 'default-1',
            label: 'Titular',
            number: unit.residentPhone || '(11) 99999-0000',
            isWhatsapp: true
          }
        ];

    const results: WhatsappDispatchStatus[] = [];

    for (const contact of contacts) {
      const recipientName = contact.label === 'Titular' 
        ? unit.residentName 
        : `${unit.residentName} (${contact.label})`;

      const messageText = this.buildMessageText(pkg, recipientName);
      const cleanPhone = contact.number.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

      // If live Evolution API credentials are provided, attempt real HTTP POST
      let isLiveSent = false;
      if (this.config.apiUrl && this.config.apiKey && this.config.instanceName) {
        try {
          const endpoint = `${this.config.apiUrl.replace(/\/$/, '')}/message/sendText/${this.config.instanceName}`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': this.config.apiKey
            },
            body: JSON.stringify({
              number: formattedPhone,
              text: messageText,
              options: {
                delay: 1200,
                presence: 'composing',
                linkPreview: true
              }
            })
          });

          if (response.ok) {
            isLiveSent = true;
          }
        } catch (err) {
          console.warn('[Evolution API] Real dispatch fallback to simulation mode:', err);
        }
      }

      results.push({
        status: isLiveSent ? 'SENT' : 'SIMULATED',
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
   * Dispatches Welcome message + LGPD terms confirmation to all registered unit phones
   */
  public async dispatchWelcomeToUnit(unit: Unit): Promise<WhatsappDispatchStatus[]> {
    const contacts = unit.residentPhones && unit.residentPhones.length > 0
      ? unit.residentPhones
      : [
          {
            id: 'default-1',
            label: 'Titular',
            number: unit.residentPhone || '(11) 99999-0000',
            isWhatsapp: true
          }
        ];

    const pwaAppUrl = typeof window !== 'undefined' ? `${window.location.origin}?unit=${unit.id}&role=morador` : 'https://village-azaleia.app';
    const results: WhatsappDispatchStatus[] = [];

    for (const contact of contacts) {
      const recipientName = contact.label === 'Titular'
        ? unit.residentName
        : `${unit.residentName} (${contact.label})`;

      const messageText =
        `🌿 *CONDOMÍNIO RESIDENCIAL VILLAGE AZALEIA*\n` +
        `✅ *Confirmação de Cadastro & Termo LGPD Aceito*\n\n` +
        `Olá, *${recipientName}*! Seu cadastro para o *Bloco ${unit.block} - Apartamento ${unit.apartment}* foi concluído com sucesso no Sistema Inteligente de Encomendas do Village Azaleia.\n\n` +
        `🔒 *Termo de Privacidade & LGPD (Lei 13.709/2018):*\n` +
        `Você autorizou o tratamento dos seus contatos exclusivamente para notificações transacionais de encomendas e segurança física condominial.\n\n` +
        `📲 *Instale o aplicativo na tela inicial do seu celular:*\n` +
        `${pwaAppUrl}\n\n` +
        `_A partir de agora você receberá alertas em tempo real sempre que uma entrega chegar para você!_`;

      const cleanPhone = contact.number.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

      let isLiveSent = false;
      if (this.config.apiUrl && this.config.apiKey && this.config.instanceName) {
        try {
          const endpoint = `${this.config.apiUrl.replace(/\/$/, '')}/message/sendText/${this.config.instanceName}`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': this.config.apiKey
            },
            body: JSON.stringify({
              number: formattedPhone,
              text: messageText,
              options: { delay: 1000, presence: 'composing', linkPreview: true }
            })
          });
          if (response.ok) isLiveSent = true;
        } catch (err) {
          console.warn('[Evolution API] Welcome dispatch fallback:', err);
        }
      }

      results.push({
        status: isLiveSent ? 'SENT' : 'SIMULATED',
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
   * Dispatches Digital Delivery Receipt message to all registered unit phones
   */
  public async dispatchReceiptToUnit(pkg: PackageItem, unit: Unit): Promise<WhatsappDispatchStatus[]> {
    const contacts = unit.residentPhones && unit.residentPhones.length > 0
      ? unit.residentPhones
      : [
          {
            id: 'default-1',
            label: 'Titular',
            number: unit.residentPhone || '(11) 99999-0000',
            isWhatsapp: true
          }
        ];

    const protocol = pkg.receiptProtocol || `REC-VA-${pkg.id.replace(/\D/g, '').slice(-8) || '20260829'}`;
    const pickupDate = pkg.pickedUpAt ? new Date(pkg.pickedUpAt) : new Date();
    const formattedTime = pickupDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = pickupDate.toLocaleDateString('pt-BR');
    const pwaAppUrl = typeof window !== 'undefined' ? `${window.location.origin}?unit=${unit.id}&role=morador` : 'https://village-azaleia.app';

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
        `🛡️ *Operador:* ${pkg.operatorName || 'Portaria'}\n` +
        `🕒 *Data/Hora:* ${formattedDate} às ${formattedTime}\n` +
        `✍️ *Assinatura Digital:* Registrada com validade jurídica (MP 2.200-2/2001)\n\n` +
        `📲 *Visualize ou baixe o recibo com foto e assinatura em seu app:*\n` +
        `${pwaAppUrl}\n\n` +
        `_Village Azaleia • Segurança e Transparência em cada entrega._`;

      const cleanPhone = contact.number.replace(/\D/g, '');
      const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

      let isLiveSent = false;
      if (this.config.apiUrl && this.config.apiKey && this.config.instanceName) {
        try {
          const endpoint = `${this.config.apiUrl.replace(/\/$/, '')}/message/sendText/${this.config.instanceName}`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': this.config.apiKey
            },
            body: JSON.stringify({
              number: formattedPhone,
              text: messageText,
              options: { delay: 1000, presence: 'composing', linkPreview: true }
            })
          });
          if (response.ok) isLiveSent = true;
        } catch (err) {
          console.warn('[Evolution API] Receipt dispatch fallback:', err);
        }
      }

      results.push({
        status: isLiveSent ? 'SENT' : 'SIMULATED',
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
