"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { ForgotPasswordSchema, type ForgotPasswordInput } from "../auth.schema";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage, notify, notifyError } from "@/lib/notifications";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [countdown, setCountdown] = useState(0);
  const { sendOtp, resetPassword, isLoading, isOtpLoading } = useAuth();
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: "", code: "", newPassword: "" },
  });
  const email = useWatch({ control: form.control, name: "email" });

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const requestOtp = async (resend = false) => {
    if (!(await form.trigger("email"))) return;
    sendOtp.forgot.mutate(email, {
      onSuccess: () => {
        notify.info(resend ? "New recovery code sent" : "Recovery code sent", {
          id: "forgot-password-otp",
          description: `Check ${email} for the one-time recovery code.`,
        });
        setCountdown(60);
        form.setValue("code", "");
        if (!resend) setStep(2);
      },
      onError: (error: unknown) =>
        notifyError(
          "Recovery code could not be sent",
          error,
          "Check the email address and try again.",
          { id: "forgot-password-otp" },
        ),
    });
  };

  const continueToPassword = async () => {
    if (await form.trigger("code")) setStep(3);
  };

  const submitReset = (data: ForgotPasswordInput) =>
    resetPassword(data, {
      onSuccess: () => {
        notify.success("Password updated", {
          id: "forgot-password-reset",
          description: "Sign in with your new password to continue.",
        });
        router.push("/login");
      },
      onError: (error: unknown) => {
        const message = getErrorMessage(error, "The password could not be reset. Request a new code and try again.");
        notify.error("Password could not be updated", {
          id: "forgot-password-reset",
          description: message,
        });
        if (/otp|code|expired/i.test(message)) setStep(2);
      },
    });

  return (
    <Card className="border-white/10 bg-background/95 shadow-2xl backdrop-blur-xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex gap-2">
          {[1, 2, 3].map((item) => <span key={item} className={`h-1.5 w-12 rounded-full ${step >= item ? "bg-primary" : "bg-muted"}`} />)}
        </div>
        <CardTitle className="text-2xl">
          {step === 1 ? "Recover account access" : step === 2 ? "Verify recovery code" : "Set a new password"}
        </CardTitle>
        <CardDescription>
          {step === 1
            ? "Enter the account email to request a one-time recovery code."
            : step === 2
              ? `Enter the code sent to ${email}.`
              : "Choose a new password for this account."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="space-y-4">
            {step === 1 ? (
              <>
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input type="email" autoComplete="email" className="pl-9" placeholder="you@example.com" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button className="w-full" type="button" disabled={isOtpLoading} onClick={() => requestOtp(false)}>
                  {isOtpLoading ? <Loader2 className="animate-spin" /> : <Mail />}
                  {isOtpLoading ? "Sending code" : "Send recovery code"}
                </Button>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>One-time code</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="h-14 text-center text-2xl font-bold tracking-[0.4em]" placeholder="000000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="button" className="w-full" onClick={continueToPassword}>Continue<ArrowRight /></Button>
                <Button type="button" variant="link" className="w-full" disabled={countdown > 0 || isOtpLoading} onClick={() => requestOtp(true)}>
                  {countdown > 0 ? `Resend in ${countdown}s` : "Resend recovery code"}
                </Button>
              </>
            ) : null}

            {step === 3 ? (
              <form onSubmit={form.handleSubmit(submitReset)} className="space-y-4">
                <FormField control={form.control} name="newPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input type="password" autoComplete="new-password" className="pl-9" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                  {isLoading ? "Updating password" : "Update password"}
                </Button>
              </form>
            ) : null}

            <Button type="button" variant="ghost" className="w-full" onClick={() => step === 1 ? router.push("/login") : setStep((current) => (current - 1) as 1 | 2 | 3)}>
              <ArrowLeft />{step === 1 ? "Back to sign in" : "Previous step"}
            </Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
