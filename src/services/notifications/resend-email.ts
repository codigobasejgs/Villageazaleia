import { PackageItem, Unit, EmailDispatchStatus } from '../../types';
import { supabase } from '../../lib/supabase';

const SEND_TIMEOUT_MS = 20000;

export class ResendEmailService {
  /**
   * Envia via o backend (/api/email/send) — a apikey da Resend nunca fica no navegador.
   * Mesmo padrão de segurança usado pro WhatsApp (evolution-whatsapp.ts).
   */
  private async sendViaBackend(to: string, subject: string, html: string): Promise<'SENT' | 'FAILED'> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ to, subject, html }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
      });
      if (!response.ok) return 'FAILED';
      const data = await response.json();
      return data.status === 'SENT' ? 'SENT' : 'FAILED';
    } catch (err) {
      console.warn('[Resend] Falha ao chamar /api/email/send:', err);
      return 'FAILED';
    }
  }

  /**
   * Generates the branded HTML email template for Village Azaleia
   */
  public generateEmailHtml(pkg: PackageItem, unit: Unit): string {
    const formattedTime = new Date(pkg.receivedAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const formattedDate = new Date(pkg.receivedAt).toLocaleDateString('pt-BR');
    const pwaAppUrl = typeof window !== 'undefined' ? window.location.origin : 'https://villageazaleia.vercel.app';

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sua encomenda chegou! • Residencial Village Azaleia</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F9FA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1A2E22;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8F9FA; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; border: 2px solid #D4AF37; box-shadow: 0 10px 25px rgba(13, 56, 35, 0.08);" cellspacing="0" cellpadding="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #061D12 0%, #0D3823 100%); padding: 32px 24px; text-align: center; border-bottom: 3px solid #D4AF37;">
              <table role="presentation" align="center" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: #D81B60; color: #FFFFFF; font-weight: 900; font-size: 20px; width: 44px; height: 44px; line-height: 44px; border-radius: 14px; border: 2px solid #D4AF37; margin-bottom: 8px;">VA</div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <span style="font-size: 11px; font-weight: 800; color: #FFF2B2; text-transform: uppercase; letter-spacing: 2px; display: block; margin-top: 4px;">Condomínio Residencial</span>
                    <h1 style="color: #FFFFFF; font-size: 22px; font-weight: 900; margin: 2px 0 0 0; letter-spacing: 0.5px;">VILLAGE AZALEIA</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Notification Title Badge -->
          <tr>
            <td style="padding: 24px 28px 12px 28px;">
              <div style="display: inline-block; background-color: #FCE4EC; color: #D81B60; font-size: 11px; font-weight: 900; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; border: 1px solid #F48FB1;">
                📦 Encomenda Recebida na Portaria
              </div>
              <h2 style="font-size: 20px; font-weight: 800; color: #0D3823; margin: 12px 0 6px 0;">
                Olá, ${unit.residentName}!
              </h2>
              <p style="font-size: 14px; color: #4A5568; line-height: 1.5; margin: 0;">
                Uma nova encomenda destinada à sua unidade (<strong>Bloco ${pkg.block} - Apartamento ${pkg.apartment}</strong>) acabou de ser recebida e catalogada com segurança em nosso estoque de encomendas.
              </p>
            </td>
          </tr>

          <!-- Parcel Photo Card -->
          ${pkg.photoUrl ? `
          <tr>
            <td style="padding: 0 28px 16px 28px;">
              <table role="presentation" width="100%" style="background-color: #F8F9FA; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden;" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 12px; text-align: center;">
                    <img src="${pkg.photoUrl}" alt="Foto da Encomenda" style="width: 100%; max-height: 220px; object-fit: cover; border-radius: 12px; border: 1px solid #CBD5E0;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Parcel Details Table -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <table role="presentation" width="100%" style="background-color: #F8F9FA; border-radius: 16px; border: 1px solid #E2E8F0; padding: 16px;" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #718096;">Transportadora:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 800; color: #0D3823; text-align: right;">${pkg.carrier}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #718096; border-top: 1px dashed #E2E8F0;">Rastreio / Código:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-family: monospace; font-weight: 700; color: #0D3823; text-align: right;">${pkg.trackingCode}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #718096; border-top: 1px dashed #E2E8F0;">Localização no Estoque:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 900; color: #D81B60; text-align: right;">
                    Estante ${pkg.shelf.shelf} • Prateleira ${pkg.shelf.level}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #718096; border-top: 1px dashed #E2E8F0;">Recebido em:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #4A5568; text-align: right;">${formattedDate} às ${formattedTime}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Primary CTA Button -->
          <tr>
            <td style="padding: 0 28px 30px 28px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${pwaAppUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #D81B60 0%, #AD1457 100%); color: #FFFFFF; text-decoration: none; font-size: 15px; font-weight: 900; padding: 14px 28px; border-radius: 14px; border: 2px solid #FFF2B2; box-shadow: 0 4px 12px rgba(216, 27, 96, 0.35);">
                      📱 Abrir App & Gerar QR Code de Retirada
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size: 12px; color: #A0AEC0; margin-top: 12px; margin-bottom: 0;">
                Apresente o QR Code na portaria para retirada rápida e sem filas.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #061D12; padding: 20px 24px; text-align: center; border-top: 1px solid #15462D;">
              <p style="font-size: 11px; color: #FFF2B2; font-weight: 700; margin: 0 0 4px 0;">
                Residencial Village Azaleia • Sistema Inteligente de Portaria
              </p>
              <p style="font-size: 10px; color: #A0AEC0; margin: 0;">
                Este é um e-mail automático do sistema de encomendas. Por favor, não responda a esta mensagem.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Dispatches email notification via Resend API (or simulation mode if key is missing)
   */
  public async sendParcelNotification(pkg: PackageItem, unit: Unit): Promise<EmailDispatchStatus> {
    const emailHtml = this.generateEmailHtml(pkg, unit);
    const subject = `📦 Sua encomenda ${pkg.carrier} chegou! [Bloco ${pkg.block} Apt ${pkg.apartment}]`;
    const recipientEmail = unit.residentEmail?.trim();

    if (!recipientEmail || !recipientEmail.includes('@') || recipientEmail.startsWith('morador@villageazaleia')) {
      return {
        status: 'FAILED',
        recipientEmail: recipientEmail || '(sem e-mail)',
        recipientName: unit.residentName,
        subject,
        deliveredAt: new Date().toISOString(),
        htmlPreview: emailHtml
      };
    }

    const res = await this.sendViaBackend(recipientEmail, subject, emailHtml);

    return {
      status: res,
      recipientEmail,
      recipientName: unit.residentName,
      subject,
      deliveredAt: new Date().toISOString(),
      htmlPreview: emailHtml
    };
  }

  /**
   * Generates branded Welcome HTML Email with LGPD terms summary
   */
  public generateWelcomeEmailHtml(unit: Unit): string {
    const pwaAppUrl = typeof window !== 'undefined' ? window.location.origin : 'https://villageazaleia.vercel.app';
    const regDate = new Date().toLocaleDateString('pt-BR');

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Bem-vindo ao Village Azaleia • Confirmação de Cadastro e LGPD</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F9FA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1A2E22;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8F9FA; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; border: 2px solid #D4AF37; box-shadow: 0 10px 25px rgba(13, 56, 35, 0.08);" cellspacing="0" cellpadding="0">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #061D12 0%, #0D3823 100%); padding: 32px 24px; text-align: center; border-bottom: 3px solid #D4AF37;">
              <span style="font-size: 11px; font-weight: 800; color: #FFF2B2; text-transform: uppercase; letter-spacing: 2px; display: block;">Condomínio Residencial</span>
              <h1 style="color: #FFFFFF; font-size: 22px; font-weight: 900; margin: 4px 0 0 0;">VILLAGE AZALEIA</h1>
            </td>
          </tr>

          <!-- Welcome Body -->
          <tr>
            <td style="padding: 28px 28px 12px 28px;">
              <div style="display: inline-block; background-color: #E8F5E9; color: #0D3823; font-size: 11px; font-weight: 900; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; border: 1px solid #A5D6A7;">
                ✓ Cadastro Ativado & LGPD em Conformidade
              </div>
              <h2 style="font-size: 20px; font-weight: 800; color: #0D3823; margin: 12px 0 6px 0;">
                Bem-vindo(a), ${unit.residentName}!
              </h2>
              <p style="font-size: 14px; color: #4A5568; line-height: 1.5; margin: 0;">
                Seu cadastro para a unidade <strong>Bloco ${unit.block} - Apartamento ${unit.apartment}</strong> foi efetuado com sucesso no Sistema Inteligente de Notificações de Encomendas.
              </p>
            </td>
          </tr>

          <!-- LGPD Terms Summary Box -->
          <tr>
            <td style="padding: 12px 28px;">
              <table role="presentation" width="100%" style="background-color: #F0FDF4; border-radius: 16px; border: 1px solid #BBF7D0; padding: 16px;" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size: 12px; font-weight: 800; color: #166534; padding-bottom: 6px;">
                    🔒 Termo de Consentimento LGPD (Lei 13.709/2018)
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #374151; line-height: 1.5;">
                    Data do aceite formal: <strong>${regDate}</strong><br/>
                    Finalidade: Notificações transacionais de encomendas via WhatsApp, E-mail e Web Push, controle de acesso e auditoria de segurança condominial.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- PWA Action Button -->
          <tr>
            <td style="padding: 16px 28px 28px 28px; text-align: center;">
              <a href="${pwaAppUrl}" target="_blank" style="display: block; background: linear-gradient(135deg, #0D3823 0%, #15462D 100%); color: #FFF2B2; text-decoration: none; font-weight: 800; font-size: 15px; padding: 14px 24px; border-radius: 14px; border: 2px solid #D4AF37; box-shadow: 0 4px 12px rgba(13, 56, 35, 0.25);">
                📲 Abrir e Instalar Aplicativo do Morador
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F9FA; padding: 16px 28px; text-align: center; border-top: 1px solid #E2E8F0;">
              <p style="font-size: 11px; color: #718096; margin: 0 0 4px 0;">
                Condomínio Residencial Village Azaleia • Portaria Central 24h
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Generates branded Delivery Receipt HTML Email
   */
  public generateDeliveryReceiptHtml(pkg: PackageItem, unit: Unit): string {
    const protocol = pkg.receiptProtocol || `REC-VA-${pkg.id.replace(/\D/g, '').slice(-8) || '20260829'}`;
    const pickupDate = pkg.pickedUpAt ? new Date(pkg.pickedUpAt) : new Date();
    const formattedTime = pickupDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = pickupDate.toLocaleDateString('pt-BR');
    const pwaAppUrl = typeof window !== 'undefined' ? window.location.origin : 'https://villageazaleia.vercel.app';

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante Oficial de Retirada • Village Azaleia</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F9FA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1A2E22;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8F9FA; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; border: 2px solid #D4AF37; box-shadow: 0 10px 25px rgba(13, 56, 35, 0.08);" cellspacing="0" cellpadding="0">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #061D12 0%, #0D3823 100%); padding: 32px 24px; text-align: center; border-bottom: 3px solid #D4AF37;">
              <span style="font-size: 11px; font-weight: 800; color: #FFF2B2; text-transform: uppercase; letter-spacing: 2px; display: block;">Condomínio Residencial</span>
              <h1 style="color: #FFFFFF; font-size: 22px; font-weight: 900; margin: 4px 0 0 0;">VILLAGE AZALEIA</h1>
            </td>
          </tr>

          <!-- Receipt Banner -->
          <tr>
            <td style="padding: 24px 28px 12px 28px;">
              <div style="display: inline-block; background-color: #E8F5E9; color: #0D3823; font-size: 11px; font-weight: 900; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; border: 1px solid #A5D6A7;">
                🧾 Recibo Oficial de Retirada Concluída
              </div>
              <h2 style="font-size: 19px; font-weight: 800; color: #0D3823; margin: 12px 0 4px 0;">
                Protocolo: ${protocol}
              </h2>
              <p style="font-size: 13px; color: #4A5568; margin: 0;">
                Confirmamos que a encomenda abaixo foi entregue e baixada em nosso sistema com sucesso.
              </p>
            </td>
          </tr>

          <!-- Receipt Details -->
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <table role="presentation" width="100%" style="background-color: #F8F9FA; border-radius: 16px; border: 1px solid #E2E8F0; padding: 16px;" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #718096;">Unidade Destino:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 800; color: #0D3823; text-align: right;">Bloco ${pkg.block} - Apt ${pkg.apartment}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #718096; border-top: 1px dashed #E2E8F0;">Titular:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 800; color: #0D3823; text-align: right;">${pkg.residentName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #718096; border-top: 1px dashed #E2E8F0;">Transportadora:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 800; color: #0D3823; text-align: right;">${pkg.carrier}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #718096; border-top: 1px dashed #E2E8F0;">Código / Rastreio:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-family: monospace; font-weight: 700; color: #0D3823; text-align: right;">${pkg.trackingCode}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #718096; border-top: 1px dashed #E2E8F0;">Retirado por:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 800; color: #D81B60; text-align: right;">${pkg.pickedUpBy || pkg.residentName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #718096; border-top: 1px dashed #E2E8F0;">Data e Hora da Retirada:</td>
                  <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: #166534; text-align: right;">${formattedDate} às ${formattedTime}</td>
                </tr>
              </table>
            </td>
          </tr>

          ${pkg.signatureUrl ? `
          <!-- Signature Preview in Email -->
          <tr>
            <td style="padding: 0 28px 20px 28px; text-align: center;">
              <div style="background-color: #FFFFFF; border: 2px dashed #D4AF37; border-radius: 16px; padding: 12px;">
                <span style="font-size: 10px; font-weight: 800; color: #0D3823; text-transform: uppercase; display: block; margin-bottom: 6px;">
                  ✍️ Assinatura Digital do Morador Coletada na Portaria
                </span>
                <img src="${pkg.signatureUrl}" alt="Assinatura" style="max-height: 80px; width: auto;" />
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- View in app button -->
          <tr>
            <td style="padding: 0 28px 28px 28px; text-align: center;">
              <a href="${pwaAppUrl}" target="_blank" style="display: block; background: linear-gradient(135deg, #0D3823 0%, #15462D 100%); color: #FFF2B2; text-decoration: none; font-weight: 800; font-size: 14px; padding: 12px 20px; border-radius: 12px; border: 2px solid #D4AF37;">
                Visualizar Histórico Completo no App
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F9FA; padding: 16px 28px; text-align: center; border-top: 1px solid #E2E8F0;">
              <p style="font-size: 10px; color: #A0AEC0; margin: 0;">
                Validade jurídica: Art. 10 da MP nº 2.200-2/2001 e Lei nº 14.063/2020.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Dispatches Welcome Email
   */
  public async sendWelcomeEmail(unit: Unit): Promise<EmailDispatchStatus> {
    const emailHtml = this.generateWelcomeEmailHtml(unit);
    const subject = `🌿 Bem-vindo ao Village Azaleia • Cadastro Ativado [Bloco ${unit.block} Apt ${unit.apartment}]`;
    const recipientEmail = unit.residentEmail?.trim();

    if (!recipientEmail || !recipientEmail.includes('@') || recipientEmail.startsWith('morador@villageazaleia')) {
      return {
        status: 'FAILED',
        recipientEmail: recipientEmail || '(sem e-mail)',
        recipientName: unit.residentName,
        subject,
        deliveredAt: new Date().toISOString(),
        htmlPreview: emailHtml
      };
    }

    const res = await this.sendViaBackend(recipientEmail, subject, emailHtml);

    return {
      status: res,
      recipientEmail,
      recipientName: unit.residentName,
      subject,
      deliveredAt: new Date().toISOString(),
      htmlPreview: emailHtml
    };
  }

  /**
   * Dispatches Delivery Receipt Email
   */
  public async sendDeliveryReceiptEmail(pkg: PackageItem, unit: Unit): Promise<EmailDispatchStatus> {
    const emailHtml = this.generateDeliveryReceiptHtml(pkg, unit);
    const protocol = pkg.receiptProtocol || `REC-VA-${pkg.id.replace(/\D/g, '').slice(-8) || '20260829'}`;
    const subject = `🧾 Comprovante de Retirada [Protocolo ${protocol}] • Bloco ${pkg.block} Apt ${pkg.apartment}`;
    const recipientEmail = unit.residentEmail?.trim();

    if (!recipientEmail || !recipientEmail.includes('@') || recipientEmail.startsWith('morador@villageazaleia')) {
      return {
        status: 'FAILED',
        recipientEmail: recipientEmail || '(sem e-mail)',
        recipientName: unit.residentName,
        subject,
        deliveredAt: new Date().toISOString(),
        htmlPreview: emailHtml
      };
    }

    const res = await this.sendViaBackend(recipientEmail, subject, emailHtml);

    return {
      status: res,
      recipientEmail,
      recipientName: unit.residentName,
      subject,
      deliveredAt: new Date().toISOString(),
      htmlPreview: emailHtml
    };
  }
}

export const resendService = new ResendEmailService();
