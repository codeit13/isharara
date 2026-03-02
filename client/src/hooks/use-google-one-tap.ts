import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { initGoogleOneTap } from "@/lib/googleOneTap";

export function useGoogleOneTap() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (isLoading) return;
    if (user) return; // already logged in

    initGoogleOneTap({
      queryClient,
      onError: (message) => {
        // keep this quiet for now, or surface minimal info
        console.warn("Google One Tap error", message);
      },
    });
  }, [user, isLoading, queryClient]);
}
