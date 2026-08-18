"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { OtpLoginSchema, type OtpLoginInput } from "../../auth.schema";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export function OtpLoginForm() {
  const { verifyLoginOtp, sendOtp, isOtpLoading, isLoading } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [countdown, setCountdown] = useState(0);
  const form = useForm<OtpLoginInput>({ resolver: zodResolver(OtpLoginSchema), defaultValues: { email: "", code: "" } });
  const email = form.watch("email");

  useEffect(() => { if (countdown <= 0) return; const timer = window.setTimeout(() => setCountdown((current) => current - 1), 1000); return () => window.clearTimeout(timer); }, [countdown]);

  const requestOtp = async () => {
    if (!(await form.trigger("email"))) return;
    sendOtp.login.mutate(email, { onSuccess: () => { setStep(2); setCountdown(60); } });
  };

  return <Form {...form}><form onSubmit={form.handleSubmit(verifyLoginOtp)} className="space-y-4"><FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel>Email</FormLabel><Input type="email" autoComplete="email" placeholder="you@example.com" {...field} disabled={step === 2 || isOtpLoading} /><FormMessage /></FormItem>} />{step === 2 ? <FormField control={form.control} name="code" render={({ field }) => <FormItem><FormLabel>One-time code</FormLabel><Input placeholder="000000" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="h-12 text-center text-xl font-bold tracking-[0.4em]" {...field} /><FormMessage /><div className="flex justify-end"><Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" disabled={countdown > 0 || isOtpLoading} onClick={requestOtp}>{countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}</Button></div></FormItem>} /> : null}<div className="pt-1">{step === 1 ? <Button type="button" className="w-full" onClick={requestOtp} disabled={isOtpLoading}>{isOtpLoading ? <Loader2 className="animate-spin" /> : <Mail />}{isOtpLoading ? "Sending code" : "Send email code"}</Button> : <div className="space-y-2"><Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{isLoading ? "Verifying" : "Verify and sign in"}</Button><Button type="button" variant="ghost" className="w-full" onClick={() => setStep(1)}>Use a different email</Button></div>}</div></form></Form>;
}
