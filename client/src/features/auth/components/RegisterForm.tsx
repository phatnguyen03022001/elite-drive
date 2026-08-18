"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, ShieldCheck, User, UserPlus } from "lucide-react";
import { RegisterPasswordSchema, OtpSchema, type RegisterPasswordBody } from "../auth.schema";
import { useAuth } from "@/hooks/useAuth";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notify, notifyError } from "@/lib/notifications";

export function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    sendOtp,
    verifyOtp,
    registerLoading,
    verifyRegisterOtpLoading,
    sendOtpRegisterLoading,
  } = useAuth();

  const form = useForm<RegisterPasswordBody & { code: string; role: string }>({
    resolver: zodResolver(step === 1 ? RegisterPasswordSchema : OtpSchema) as any,
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      phone: "",
      code: "",
      role: "CUSTOMER",
    },
  });

  const isSubmitting = step === 1 ? registerLoading : verifyRegisterOtpLoading;

  const resendCode = () => {
    const email = form.getValues("email");
    sendOtp.register.mutate(email, {
      onSuccess: () =>
        notify.info("Verification code sent", {
          id: "register-otp",
          description: `A new code was sent to ${email}.`,
        }),
      onError: (error: unknown) =>
        notifyError(
          "Verification code could not be sent",
          error,
          "Check the email address and try again.",
          { id: "register-otp" },
        ),
    });
  };

  const onSubmit = (data: any) => {
    if (step === 1) {
      register(data, {
        onSuccess: () => {
          notify.success("Account created", {
            id: "register-account",
            description: `Enter the verification code sent to ${data.email} to activate the account.`,
          });
          setStep(2);
        },
        onError: (error: unknown) =>
          notifyError(
            "Account could not be created",
            error,
            "Review the account details and try again.",
            { id: "register-account" },
          ),
      });
      return;
    }

    verifyOtp.register.mutate(
      { email: data.email, code: data.code },
      {
        onSuccess: () => {
          notify.success("Email verified", {
            id: "register-otp",
            description: "Your account is active. Sign in to continue to Elite Drive.",
          });
          router.push("/login");
        },
        onError: (error: unknown) =>
          notifyError(
            "Verification code not accepted",
            error,
            "The code may be invalid or expired. Request a new code and try again.",
            { id: "register-otp" },
          ),
      },
    );
  };

  return (
    <Card className="border-white/10 bg-background/95 shadow-2xl backdrop-blur-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{step === 1 ? "Create your account" : "Verify your email"}</CardTitle>
        <CardDescription>
          {step === 1
            ? "Choose how you will use Elite Drive and enter your account details."
            : `Enter the code sent to ${form.getValues("email")}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {step === 1 ? (
              <>
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account type</FormLabel>
                      <FormControl>
                        <Tabs value={field.value} onValueChange={field.onChange}>
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="CUSTOMER"><User />Renter</TabsTrigger>
                            <TabsTrigger value="OWNER"><ShieldCheck />Vehicle owner</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" autoComplete="email" placeholder="you@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showPassword ? "text" : "password"} autoComplete="new-password" className="pr-10" {...field} />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full"
                            onClick={() => setShowPassword((current) => !current)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff /> : <Eye />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="firstName" render={({ field }) => <FormItem><FormLabel>First name</FormLabel><Input placeholder="Alex" {...field} /><FormMessage /></FormItem>} />
                  <FormField control={form.control} name="lastName" render={({ field }) => <FormItem><FormLabel>Last name</FormLabel><Input placeholder="Nguyen" {...field} /><FormMessage /></FormItem>} />
                </div>
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input inputMode="tel" placeholder="0901234567" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email verification code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="000000"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          className="h-14 text-center text-2xl font-bold tracking-[0.4em]"
                          maxLength={6}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="button" variant="link" className="w-full" disabled={sendOtpRegisterLoading} onClick={resendCode}>
                  {sendOtpRegisterLoading ? "Sending code..." : "Resend verification code"}
                </Button>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : step === 1 ? <UserPlus /> : <ShieldCheck />}
              {isSubmitting ? "Processing" : step === 1 ? "Create account" : "Verify email"}
            </Button>
            {step === 2 ? <Button type="button" variant="ghost" className="w-full" onClick={() => setStep(1)}>Edit account details</Button> : null}
          </form>
        </Form>
        <div className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account? <Link href="/login" className="font-semibold text-foreground underline-offset-4 hover:underline">Sign in</Link>
        </div>
      </CardContent>
    </Card>
  );
}
