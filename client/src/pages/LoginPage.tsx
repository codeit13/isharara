import { useState } from "react";
import SEOHead from "@/components/SEOHead";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Lock, Phone, MessageCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoogleLogin } from "@react-oauth/google";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/models/auth";

const emailLoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

type EmailLoginForm = z.infer<typeof emailLoginSchema>;

export default function LoginPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { handleCredential, onError: onGoogleError } = useGoogleAuth("/");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [showWhatsapp, setShowWhatsapp] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailLoginForm>({
    resolver: zodResolver(emailLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const handleEmailLogin = async (data: EmailLoginForm) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "destructive", title: json.message || "Login failed" });
        return;
      }
      queryClient.setQueryData(["/api/auth/user"], json.user as User);
      window.location.href = "/";
    } catch {
      toast({ variant: "destructive", title: "Login failed" });
    }
  };

  const handleSendOtp = async () => {
    const phone = whatsappPhone.replace(/\D/g, "");
    if (phone.length < 10) {
      toast({ variant: "destructive", title: "Enter a valid phone number" });
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/whatsapp/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: phone.length > 10 ? phone : `91${phone}` }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "destructive", title: json.message || "Failed to send OTP" });
        return;
      }
      setOtpSent(true);
      toast({ title: "OTP sent! Enter the code you received." });
    } catch {
      toast({ variant: "destructive", title: "Failed to send OTP" });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const phone = whatsappPhone.replace(/\D/g, "");
    const otp = otpValue.trim();
    if (phone.length < 10 || otp.length !== 6) {
      toast({ variant: "destructive", title: "Enter phone and 6-digit OTP" });
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/auth/whatsapp/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phone: phone.length > 10 ? phone : `91${phone}`,
          otp,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "destructive", title: json.message || "Invalid OTP" });
        return;
      }
      queryClient.setQueryData(["/api/auth/user"], json.user as User);
      window.location.href = "/";
    } catch {
      toast({ variant: "destructive", title: "Verification failed" });
    } finally {
      setVerifyLoading(false);
    }
  };

  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const errorParam = searchParams?.get("error");

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <SEOHead title="Log In" description="Sign in to your ISHQARA account." noIndex />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif">Log in</CardTitle>
          <CardDescription>Sign in with your email and password, or use a quick login below.</CardDescription>
          {errorParam && (
            <p className="text-sm text-destructive">
              {errorParam === "google" && "Google sign-in failed. Try again or use another method."}
              {errorParam === "session" && "Session error. Please try again."}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email / password form at the top */}
          <form onSubmit={handleSubmit(handleEmailLogin)} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="pl-9"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pl-9"
                  {...register("password")}
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Log in"}
            </Button>
          </form>

          {/* OR separator */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Social / alternate login options */}
          <div className="space-y-3">
            <div className="w-full overflow-hidden">
              <GoogleLogin
                onSuccess={(res) => res.credential && handleCredential(res.credential)}
                onError={onGoogleError}
                text="continue_with"
                shape="rectangular"
                size="large"
                width="400"
                useOneTap={false}
              />
            </div>

            {/* <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => setShowWhatsapp(true)}
            >
              <MessageCircle className="h-4 w-4" />
              Continue with WhatsApp
            </Button> */}

            {showWhatsapp && (
              <div className="mt-3 space-y-4">
                <div>
                  <Label htmlFor="phone">Phone number</Label>
                  <div className="flex gap-2 mt-1.5">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="9876543210"
                        className="pl-9"
                        value={whatsappPhone}
                        onChange={(e) => setWhatsappPhone(e.target.value)}
                        disabled={otpSent}
                      />
                    </div>
                    {!otpSent ? (
                      <Button type="button" variant="outline" onClick={handleSendOtp} disabled={otpLoading}>
                        {otpLoading ? "Sending…" : "Send OTP"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {otpSent && (
                  <>
                    <div>
                      <Label>Enter 6-digit OTP</Label>
                      <div className="flex flex-col gap-2 mt-1.5">
                        <InputOTP
                          maxLength={6}
                          value={otpValue}
                          onChange={setOtpValue}
                        >
                          <InputOTPGroup>
                            {[...Array(6)].map((_, i) => (
                              <InputOTPSlot key={i} index={i} />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleVerifyOtp}
                      disabled={otpValue.length !== 6 || verifyLoading}
                    >
                      {verifyLoading ? "Verifying…" : "Verify & log in"}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Don’t have an account?{" "}
            <Link href="/register" className="text-primary font-medium underline underline-offset-2">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
