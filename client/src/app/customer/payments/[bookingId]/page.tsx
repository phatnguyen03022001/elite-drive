"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { FlaskConical, ShieldCheck, Smartphone } from "lucide-react";
import { PaymentMethodForm } from "@/features/customer/payments/[bookingId]/PaymentMethodForm";
import { QrPaymentBox } from "@/features/customer/payments/[bookingId]/QrPaymentBox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

type PaymentRecord = { id: string; amount: number; paymentMethod: "MOCK_QR" | "MOMO"; transactionId?: string; mockQrUrl?: string; };
const momoEnabled = process.env.NEXT_PUBLIC_MOMO_ENABLED === "true";

export default function PaymentPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [paymentResult, setPaymentResult] = useState<PaymentRecord | null>(null);

  return <div className="mx-auto w-full max-w-2xl space-y-6 py-4">
    <div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Checkout</p><Badge variant="secondary">Development-safe flow</Badge></div><h1 className="mt-2 text-3xl font-bold tracking-tight">Complete your booking</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">The default path stays local and zero-cost. Payment completion creates the escrow record, rental contract and upcoming trip in one backend transaction.</p></div>
    <div className={`grid gap-3 ${momoEnabled ? "sm:grid-cols-2" : ""}`}>
      {momoEnabled ? <Card><CardHeader className="gap-3"><div className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="h-4 w-4" />MoMo sandbox</div><CardDescription className="leading-6">Optional provider integration. Redirects are never treated as proof of payment.</CardDescription></CardHeader></Card> : null}
      <Card className="border-dashed"><CardHeader className="gap-3"><div className="flex items-center gap-2 text-sm font-semibold"><FlaskConical className="h-4 w-4" />Local development mock</div><CardDescription className="leading-6">Default portfolio flow. No external payment account is required.</CardDescription></CardHeader></Card>
    </div>
    <Card><CardHeader className="pb-0"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><ShieldCheck className="h-4 w-4" />Authenticated booking checkout</div></CardHeader><CardContent>{!paymentResult ? <PaymentMethodForm bookingId={bookingId} onSuccess={(payment) => setPaymentResult({ ...payment, transactionId: payment.transactionId ?? undefined })} /> : <QrPaymentBox bookingId={bookingId} payment={paymentResult} />}</CardContent></Card>
  </div>;
}
