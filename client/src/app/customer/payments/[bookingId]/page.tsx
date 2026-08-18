"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { PaymentMethodForm } from "@/features/customer/payments/[bookingId]/PaymentMethodForm";
import { QrPaymentBox } from "@/features/customer/payments/[bookingId]/QrPaymentBox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [paymentResult, setPaymentResult] = useState<any>(null);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Checkout</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Complete your booking</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Payment test mode is enabled. Elite Drive still creates the booking and payment state transitions, but no
          external payment processor or real-money settlement is connected.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader className="flex-row items-start gap-3">
          <div className="rounded-xl bg-muted p-2.5">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Payment test mode</CardTitle>
            <CardDescription className="mt-1 leading-6">
              Exercise the transaction workflow without entering card or bank details. No funds are collected.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Authenticated booking checkout
          </div>
        </CardHeader>
        <CardContent>
          {!paymentResult ? (
            <PaymentMethodForm bookingId={bookingId} onSuccess={setPaymentResult} />
          ) : (
            <QrPaymentBox bookingId={bookingId} payment={paymentResult} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
