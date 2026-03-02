import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/models/auth";

/**
 * Shared handler for all Google sign-in flows (One Tap + button).
 * Uses window.location.href so the redirect always fires reliably,
 * even when called from async One Tap callbacks or stale closures.
 */
export function useGoogleAuth(redirectTo = "/") {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCredential = async (credential: string) => {
    try {
      const res = await fetch("/api/auth/google-one-tap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credential }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "destructive", title: json.message || "Google sign-in failed" });
        return;
      }
      queryClient.setQueryData(["/api/auth/user"], json.user as User);
      window.location.href = redirectTo;
    } catch {
      toast({ variant: "destructive", title: "Google sign-in failed" });
    }
  };

  const onError = () => {
    toast({ variant: "destructive", title: "Google sign-in failed. Try again." });
  };

  return { handleCredential, onError };
}
