"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { LoginRequestSchema, type LoginRequest } from "../../auth.schema";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export function PasswordLoginForm() {
  const { login, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginRequest>({ resolver: zodResolver(LoginRequestSchema), defaultValues: { email: "", password: "" } });

  return <Form {...form}><form onSubmit={form.handleSubmit(login)} className="space-y-4"><FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel>Email</FormLabel><Input type="email" autoComplete="email" placeholder="you@example.com" {...field} /><FormMessage /></FormItem>} /><FormField control={form.control} name="password" render={({ field }) => <FormItem><FormLabel>Password</FormLabel><div className="relative"><Input type={showPassword ? "text" : "password"} autoComplete="current-password" className="pr-10" {...field} /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</Button></div><FormMessage /></FormItem>} /><Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin" /> : <LogIn />}{isLoading ? "Signing in" : "Sign in"}</Button></form></Form>;
}
