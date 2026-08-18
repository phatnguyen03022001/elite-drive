"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
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
          This portfolio deployment uses Elite Drive&apos;s payment sandbox. It exercises the real booking, payment record,
          escrow, and trip-confirmation workflow without moving real funds.
        </p>
      </div>

      <Card className="border-dashed">
        <CardHeader className="flex-row items-start gap-3">
          <div className="rounded-xl bg-muted p-2.5">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Payment sandbox</CardTitle>
            <CardDescription className="mt-1 leading-6">
              No card, bank account, or real-money transaction is required in this public portfolio environment.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-0">
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
