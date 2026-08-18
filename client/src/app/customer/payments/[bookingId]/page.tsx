"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { FlaskConical, ShieldCheck, Smartphone } from "lucide-react";
import { PaymentMethodForm } from "@/features/customer/payments/[bookingId]/PaymentMethodForm";
import { QrPaymentBox } from "@/features/customer/payments/[bookingId]/QrPaymentBox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

type PaymentRecord = {
  id: string;
  amount: number;
  paymentMethod: "MOCK_QR" | "MOMO";
  transactionId?: string;
  mockQrUrl?: string;
};

export default function PaymentPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [paymentResult, setPaymentResult] = useState<PaymentRecord | null>(null);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Checkout</p>
          <Badge variant="secondary">Sandbox environment</Badge>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Complete your booking</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          MoMo checkout uses the provider sandbox when configured. No production funds are collected in this environment, but the full redirect, IPN, status verification and booking state flow are exercised.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="h-4 w-4" />MoMo sandbox</div>
            <CardDescription className="leading-6">
              External provider integration. Success is accepted only after Elite Drive verifies MoMo server-side.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-dashed">
          <CardHeader className="gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><FlaskConical className="h-4 w-4" />Developer mock</div>
            <CardDescription className="leading-6">
              Local-only fallback for testing state transitions. The backend refuses this mode in production.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Authenticated booking checkout
          </div>
        </CardHeader>
        <CardContent>
          {!paymentResult ? (
            <PaymentMethodForm bookingId={bookingId} onSuccess={(payment) => setPaymentResult({ ...payment, transactionId: payment.transactionId ?? undefined })} />
          ) : (
            <QrPaymentBox bookingId={bookingId} payment={paymentResult} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
