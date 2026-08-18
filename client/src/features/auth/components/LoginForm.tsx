"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PasswordLoginForm } from "./login/PasswordLoginForm";
import { OtpLoginForm } from "./login/OtpLoginForm";

export function LoginForm() {
  const [method, setMethod] = useState<"password" | "otp">("password");
  return <Card className="border-white/10 bg-background/95 shadow-2xl backdrop-blur-xl"><CardHeader className="text-center"><CardTitle className="text-2xl">Welcome back</CardTitle><CardDescription>Sign in to continue to your Elite Drive workspace.</CardDescription></CardHeader><CardContent><Tabs value={method} onValueChange={(value) => setMethod(value as "password" | "otp")}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="password"><KeyRound />Password</TabsTrigger><TabsTrigger value="otp"><Mail />Email OTP</TabsTrigger></TabsList><TabsContent value="password" className="mt-6"><PasswordLoginForm /></TabsContent><TabsContent value="otp" className="mt-6"><OtpLoginForm /></TabsContent></Tabs></CardContent><CardFooter className="flex flex-col gap-3 border-t pt-5 text-sm"><div className="flex w-full items-center justify-between gap-3"><Link href="/forgot-password" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Forgot password?</Link><Link href="/register" className="font-semibold underline-offset-4 hover:underline">Create account</Link></div></CardFooter></Card>;
}
