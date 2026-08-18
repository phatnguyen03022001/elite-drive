"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { OtpSchema, type VerifyOtpInput } from "../auth.schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = { email: string; onVerify: (data: VerifyOtpInput) => void; isLoading?: boolean; onResend?: () => void };

export function OtpForm({ email, onVerify, isLoading, onResend }: Props) {
  const form = useForm<VerifyOtpInput>({ resolver: zodResolver(OtpSchema), defaultValues: { email, code: "" } });
  return <div className="space-y-6"><div className="text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Mail className="h-5 w-5" /></div><h2 className="mt-4 text-xl font-semibold">Verify your email</h2><p className="mt-2 text-sm text-muted-foreground">Enter the code sent to <span className="font-medium text-foreground">{email}</span>.</p></div><Form {...form}><form onSubmit={form.handleSubmit(onVerify)} className="space-y-5"><FormField control={form.control} name="code" render={({ field }) => <FormItem><FormLabel className="sr-only">Verification code</FormLabel><FormControl><Input {...field} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="h-14 text-center text-2xl font-bold tracking-[0.4em]" maxLength={6} disabled={isLoading} /></FormControl><FormMessage className="text-center" /></FormItem>} /><Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{isLoading ? "Verifying" : "Verify code"}</Button>{onResend ? <div className="text-center text-sm text-muted-foreground">Didn&apos;t receive a code? <Button type="button" variant="link" size="sm" onClick={onResend} disabled={isLoading} className="px-1">Resend</Button></div> : null}</form></Form></div>;
}
