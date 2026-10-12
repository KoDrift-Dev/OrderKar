// Shared notification utility: sound + vibration + browser notifications.
// Used by waiter and kitchen apps for order events.

export type NotifyKind = 'new_order' | 'order_ready' | 'items_added' | 'payment' | 'cancelled';

const SOUND_PATTERNS: Record<NotifyKind, { freq: number; times: number; gap: number }[]> = {
  // Urgent triple-beep for new orders (kitchen).
  new_order: [
    { freq: 880, times: 3, gap: 0.22 },
    { freq: 1174, times: 2, gap: 0.22 },
  ],
  // Double chime when food is ready (waiter pickup).
  order_ready: [{ freq: 1046, times: 2, gap: 0.3 }],
  // Single blip for appended items.
  items_added: [{ freq: 880, times: 1, gap: 0 }],
  // Cash-register style for payment.
  payment: [
    { freq: 1318, times: 1, gap: 0 },
    { freq: 1568, times: 1, gap: 0.15 },
  ],
  // Low tone for cancellations.
  cancelled: [{ freq: 440, times: 2, gap: 0.3 }],
};

const VIBRATE_PATTERNS: Record<NotifyKind, number[]> = {
  new_order: [200, 100, 200, 100, 300],
  order_ready: [150, 100, 150],
  items_added: [100],
  payment: [100, 50, 100],
  cancelled: [300, 100, 300],
};

function playSound(kind: NotifyKind): void {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    let t = ctx.currentTime + 0.05;
    for (const { freq, times, gap } of SOUND_PATTERNS[kind]) {
      for (let i = 0; i < times; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.4, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.22);
        t += gap;
      }
      t += 0.15;
    }
    // Clean up the context after the pattern finishes.
    window.setTimeout(() => void ctx.close().catch(() => undefined), (t - ctx.currentTime) * 1000 + 500);
  } catch {
    /* audio unavailable — vibration still fires */
  }
}

function vibrate(kind: NotifyKind): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(VIBRATE_PATTERNS[kind]);
  } catch {
    /* vibration unsupported */
  }
}

/** Fire sound + vibration for an order event. Safe to call anywhere. */
export function notify(kind: NotifyKind): void {
  if (typeof window === 'undefined') return;
  playSound(kind);
  vibrate(kind);
}

/** Ask for browser-notification permission (call from a user gesture). */
export function ensureNotificationPermission(): void {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  } catch {
    /* ignore */
  }
}

/** Show a browser notification if permission was granted. */
export function pushNotify(title: string, body: string): void {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, tag: 'orderkar' });
    }
  } catch {
    /* ignore */
  }
}
