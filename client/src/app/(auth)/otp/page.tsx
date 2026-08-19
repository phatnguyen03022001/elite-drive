"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OtpForm } from "@/features/auth/components/OtpForm";
import { authService } from "@/features/auth/auth.service";
import { notify, notifyError } from "@/lib/notifications";

type OtpMode = "register" | "login" | "forgot";
type OtpPayload = { email: string; code: string };

function isOtpMode(value: string | null): value is OtpMode {
  return value === "register" || value === "login" || value === "forgot";
}

function workspaceForRole(role?: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "OWNER") return "/owner/dashboard";
  return "/customer/cars";
}

export default function OtpPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get("type");
  const email = searchParams.get("email")?.trim() ?? "";
  const validRequest = isOtpMode(type) && email.length > 0;

  useEffect(() => {
    if (!validRequest) router.replace("/login");
  }, [router, validRequest]);

  const verifyRegisterOtp = useMutation({
    mutationFn: ({ email: payloadEmail, code }: OtpPayload) =>
      authService.otp.verify.register(payloadEmail, code),
    onSuccess: () => {
      notify.success("Registration verified", {
        id: "otp-register",
        description: "Your account is verified. You can sign in now.",
      });
      router.replace("/login");
    },
    onError: (error: unknown) =>
      notifyError(
        "Verification code not accepted",
        error,
        "The code may be invalid or expired. Request a new code and try again.",
        { id: "otp-register" },
      ),
  });

  const verifyLoginOtp = useMutation({
    mutationFn: ({ email: payloadEmail, code }: OtpPayload) =>
      authService.otp.verify.login(payloadEmail, code),
    onSuccess: async () => {
      try {
        const profile = await authService.getProfile();
        notify.success("Signed in", {
          id: "otp-login",
          description: "Your Elite Drive workspace is ready.",
        });
        router.replace(workspaceForRole(profile?.role));
        router.refresh();
      } catch (error) {
        notifyError(
          "Session verification failed",
          error,
          "The OTP was accepted, but the session could not be verified. Sign in again.",
          { id: "otp-login" },
        );
        router.replace("/login");
      }
    },
    onError: (error: unknown) =>
      notifyError(
        "Verification code not accepted",
        error,
        "The code may be invalid or expired. Request a new code and try again.",
        { id: "otp-login" },
      ),
  });

  const verifyForgotOtp = useMutation({
    mutationFn: ({ email: payloadEmail, code }: OtpPayload) =>
      authService.otp.verify.forgot(payloadEmail, code),
    onSuccess: (_response, variables) => {
      notify.success("Verification code accepted", {
        id: "otp-forgot",
        description: "Continue to set a new password.",
      });
      const params = new URLSearchParams({
        email: variables.email,
        code: variables.code,
      });
      router.replace(`/forgot-password?${params.toString()}`);
    },
    onError: (error: unknown) =>
      notifyError(
        "Verification code not accepted",
        error,
        "The code may be invalid or expired. Request a new code and try again.",
        { id: "otp-forgot" },
      ),
  });

  if (!validRequest) return null;

  const verifyOtp =
    type === "register"
      ? verifyRegisterOtp
      : type === "login"
        ? verifyLoginOtp
        : verifyForgotOtp;

  const titles: Record<OtpMode, string> = {
    register: "Verify registration",
    login: "Verify sign-in",
    forgot: "Verify password reset",
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-center text-2xl">{titles[type]}</CardTitle>
        <CardDescription className="text-center">
          Enter the verification code sent to <strong>{email}</strong>.
        </CardDescription>
      </CardHeader>
      <OtpForm
        email={email}
        onVerify={(payload) => verifyOtp.mutate(payload)}
        isLoading={verifyOtp.isPending}
      />
    </Card>
  );
}
