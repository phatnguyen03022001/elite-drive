"use client";

import { useState } from "react";
import { CreditCard, Loader2, Smartphone } from "lucide-react";
import { CustomerService } from "@/features/customer/customer.service";
import { Button } from "@/components/ui/button";
import { notifyError } from "@/lib/notifications";

interface PaymentRecord {
  id: string;
  amount: number;
  paymentMethod: "MOCK_QR" | "MOMO";
  transactionId?: string | null;
}

export function PaymentMethodForm({
  bookingId,
  onSuccess,
}: {
  bookingId: string;
  onSuccess: (payment: PaymentRecord) => void;
}) {
  const [submitting, setSubmitting] = useState<"MOCK_QR" | "MOMO" | null>(null);

  const startMockPayment = async () => {
    setSubmitting("MOCK_QR");
    try {
      const payment = (await CustomerService.createPayment({
        bookingId,
        paymentMethod: "MOCK_QR",
      })) as PaymentRecord;
      onSuccess(payment);
    } catch (error: unknown) {
      notifyError(
        "Development checkout unavailable",
        error,
        "Mock payments are disabled unless the backend explicitly enables them outside production.",
        { id: `payment-create-${bookingId}` },
      );
    } finally {
      setSubmitting(null);
    }
  };

  const startMomoPayment = async () => {
    setSubmitting("MOMO");
    try {
      const payment = (await CustomerService.createPayment({
        bookingId,
        paymentMethod: "MOMO",
      })) as PaymentRecord;
      const checkout = await CustomerService.createMomoCheckout(payment.id);
      window.location.assign(checkout.payUrl);
    } catch (error: unknown) {
      notifyError(
        "MoMo checkout could not be started",
        error,
        "The sandbox gateway may not be configured yet. No successful payment is assumed until the backend verifies MoMo.",
        { id: `payment-momo-${bookingId}` },
      );
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-5 py-1">
      <div>
        <h2 className="text-lg font-semibold">Choose a payment method</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          MoMo uses the provider sandbox when configured. The mock flow remains development-only and cannot run in production.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-muted/20 p-4">
          <Smartphone className="h-5 w-5" />
          <div className="mt-3 font-medium">MoMo sandbox</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Redirects to MoMo. Final status is verified by the backend through IPN or status query.
          </div>
          <Button className="mt-4 w-full" onClick={startMomoPayment} disabled={submitting !== null}>
            {submitting === "MOMO" ? <Loader2 className="animate-spin" /> : <Smartphone />}
            Pay with MoMo
          </Button>
        </div>

        <div className="rounded-xl border bg-muted/20 p-4">
          <CreditCard className="h-5 w-5" />
          <div className="mt-3 font-medium">Development mock</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Exercises local payment state transitions without contacting a real provider.
          </div>
          <Button variant="outline" className="mt-4 w-full" onClick={startMockPayment} disabled={submitting !== null}>
            {submitting === "MOCK_QR" ? <Loader2 className="animate-spin" /> : <CreditCard />}
            Use dev mock
          </Button>
        </div>
      </div>
    </div>
  );
}
