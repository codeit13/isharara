import { QueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

declare global {
  interface Window {
    google?: any;
  }
}

function loadGoogleScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google script failed")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google script failed"));
    document.head.appendChild(script);
  });
}

export async function initGoogleOneTap(options: {
  queryClient: QueryClient;
  onError?: (message: string) => void;
}): Promise<void> {
  if (typeof window === "undefined") return;

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) {
    // Not configured, silently skip
    return;
  }

  try {
    await loadGoogleScript();
    if (!window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response: { credential?: string }) => {
        try {
          if (!response.credential) return;
          const res = await fetch("/api/auth/google-one-tap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ credential: response.credential }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            options.onError?.(json.message || "Google One Tap login failed");
            return;
          }
          options.queryClient.setQueryData(["/api/auth/user"], json.user as User);
        } catch (e: any) {
          options.onError?.(e?.message || "Google One Tap login failed");
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    window.google.accounts.id.prompt();
  } catch (e: any) {
    options.onError?.(e?.message || "Google One Tap not available");
  }
}
