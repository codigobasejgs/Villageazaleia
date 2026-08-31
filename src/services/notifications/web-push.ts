import { PackageItem, Unit, WebPushDispatchStatus } from '../../types';
import { sound } from '../../utils/audio';

export class WebPushService {
  /**
   * Check if the browser supports Notification API
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Get current permission state ('default' | 'granted' | 'denied')
   */
  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  /**
   * Request native browser permission for push notifications
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        sound.playSuccess();
      }
      return permission;
    } catch (err) {
      console.warn('[Web Push] Error requesting notification permission:', err);
      return 'denied';
    }
  }

  /**
   * Dispatches a native Web Push notification if permission is granted, and triggers audio/vibration
   */
  public async dispatchWebPush(pkg: PackageItem, unit: Unit): Promise<WebPushDispatchStatus> {
    const title = 'Sua encomenda chegou! 📦';
    const body = `${pkg.residentName}, seu pacote ${pkg.carrier} (${pkg.trackingCode}) está disponível na Estante ${pkg.shelf.shelf}${pkg.shelf.level} da Portaria.`;

    let isSentNatively = false;

    // Trigger audio
    sound.playNotification();

    // Trigger device vibration if available
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch {
        // Ignore vibration failure
      }
    }

    // Trigger Native Notification if permitted
    if (this.isSupported() && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `pkg-${pkg.id}`,
          requireInteraction: true
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };

        isSentNatively = true;
      } catch (err) {
        console.warn('[Web Push] Native Notification error, falling back to simulated:', err);
      }
    }

    return {
      status: isSentNatively ? 'SENT' : 'SIMULATED',
      title,
      body,
      deliveredAt: new Date().toISOString()
    };
  }
}

export const webPushService = new WebPushService();
