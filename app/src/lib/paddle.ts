import type { Session } from "@/lib/session";

interface PayConfig {
  environment: "sandbox" | "production";
  clientToken: string;
  priceId: string;
}

declare global {
  interface Window {
    TC_PAY?: PayConfig;
    Paddle?: {
      Environment: { set: (e: string) => void };
      Initialize: (o: { token: string }) => void;
      Checkout: { open: (o: unknown) => void };
    };
  }
}

const SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";
let loading: Promise<void> | null = null;

export function payConfigured(): boolean {
  const c = window.TC_PAY;
  return Boolean(c && c.clientToken && c.priceId);
}

function loadPaddle(): Promise<void> {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("paddle.js failed to load"));
    document.head.appendChild(s);
  });
  return loading;
}

export async function openCheckout(session: Session): Promise<void> {
  const cfg = window.TC_PAY;
  if (!cfg || !payConfigured()) throw new Error("checkout is not configured yet");
  if (!session.sub) throw new Error("please sign in again");
  await loadPaddle();
  const paddle = window.Paddle;
  if (!paddle) throw new Error("paddle.js unavailable");

  paddle.Environment.set(cfg.environment);
  paddle.Initialize({ token: cfg.clientToken });
  paddle.Checkout.open({
    items: [{ priceId: cfg.priceId, quantity: 1 }],
    customData: { sub: session.sub },
    customer: session.email ? { email: session.email } : undefined,
    settings: { displayMode: "overlay", theme: "dark" },
  });
}
