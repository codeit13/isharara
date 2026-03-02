import { useState } from "react";
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
import { Link } from "wouter";
import type { User } from "@shared/models/auth";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

interface AdminLoginPageProps {
  onSuccess?: () => void;
}

export default function AdminLoginPage({ onSuccess }: AdminLoginPageProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { handleCredential, onError: onGoogleError } = useGoogleAuth("/admin");

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
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const afterLogin = (user: User) => {
    queryClient.setQueryData(["/api/auth/user"], user);
    toast({ title: "Welcome back" });
    onSuccess?.();
    window.location.href = "/admin";
  };

  const onSubmit = async (data: FormData) => {
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
      afterLogin(json.user as User);
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
      afterLogin(json.user as User);
    } catch {
      toast({ variant: "destructive", title: "Verification failed" });
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif">Admin login</CardTitle>
          <CardDescription>Sign in with an admin account to access the dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email / password */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="admin-email">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@example.com"
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
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin-password"
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
              {isSubmitting ? "Signing in…" : "Sign in"}
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

          {/* Social options */}
          <div className="space-y-3">
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={(res) => res.credential && handleCredential(res.credential)}
                onError={onGoogleError}
                text="continue_with"
                shape="rectangular"
                size="large"
                width="380"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => setShowWhatsapp(true)}
            >
              <MessageCircle className="h-4 w-4" />
              Continue with WhatsApp
            </Button>

            {showWhatsapp && (
              <div className="mt-3 space-y-4">
                <div>
                  <Label htmlFor="admin-phone">Phone number</Label>
                  <div className="flex gap-2 mt-1.5">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="admin-phone"
                        type="tel"
                        placeholder="9876543210"
                        className="pl-9"
                        value={whatsappPhone}
                        onChange={(e) => setWhatsappPhone(e.target.value)}
                        disabled={otpSent}
                      />
                    </div>
                    {!otpSent && (
                      <Button type="button" variant="outline" onClick={handleSendOtp} disabled={otpLoading}>
                        {otpLoading ? "Sending…" : "Send OTP"}
                      </Button>
                    )}
                  </div>
                </div>

                {otpSent && (
                  <>
                    <div>
                      <Label>Enter 6-digit OTP</Label>
                      <div className="mt-1.5">
                        <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
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
                      {verifyLoading ? "Verifying…" : "Verify & sign in"}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/" className="text-primary underline underline-offset-2">
              Back to store
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
