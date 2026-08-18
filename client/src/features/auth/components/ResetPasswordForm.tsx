"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ResetPasswordSchema = z.object({ password: z.string().min(8, "Use at least 8 characters").max(32, "Use no more than 32 characters"), confirmPassword: z.string() }).refine((data) => data.password === data.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
type FormData = z.infer<typeof ResetPasswordSchema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const form = useForm<FormData>({ resolver: zodResolver(ResetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } });
  const mutation = useMutation({ mutationFn: (data: { password: string }) => api.post("/api/auth/verify-forgot-otp", { code: token, newPassword: data.password }), onSuccess: () => { toast.success("Password updated."); router.push("/login"); }, onError: (error: any) => toast.error(error?.response?.data?.message || "Could not reset password") });

  return <Card className="border-white/10 bg-background/95 shadow-2xl backdrop-blur-xl"><CardHeader className="text-center"><div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><LockKeyhole className="h-5 w-5" /></div><CardTitle className="text-2xl">Set a new password</CardTitle><CardDescription>Choose a new password to restore account access.</CardDescription></CardHeader><CardContent><Form {...form}><form onSubmit={form.handleSubmit((data) => mutation.mutate({ password: data.password }))} className="space-y-4"><FormField control={form.control} name="password" render={({ field }) => <FormItem><FormLabel>New password</FormLabel><FormControl><div className="relative"><Input type={showPassword ? "text" : "password"} autoComplete="new-password" className="pr-10" {...field} /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</Button></div></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="confirmPassword" render={({ field }) => <FormItem><FormLabel>Confirm new password</FormLabel><FormControl><div className="relative"><Input type={showConfirm ? "text" : "password"} autoComplete="new-password" className="pr-10" {...field} /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowConfirm((current) => !current)} aria-label={showConfirm ? "Hide password" : "Show password"}>{showConfirm ? <EyeOff /> : <Eye />}</Button></div></FormControl><FormMessage /></FormItem>} /><Button type="submit" className="w-full" disabled={mutation.isPending}>{mutation.isPending ? <Loader2 className="animate-spin" /> : <LockKeyhole />}{mutation.isPending ? "Updating password" : "Update password"}</Button></form></Form></CardContent></Card>;
}
