"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { CustomerService } from "@/features/customer/customer.service";
import { Button } from "@/components/ui/button";
import { notifyError } from "@/lib/notifications";

export function PaymentMethodForm({ bookingId, onSuccess }: { bookingId: string; onSuccess: (payment: any) => void }) {
  const [submitting, setSubmitting] = useState(false);

  const createTestPayment = async () => {
    setSubmitting(true);
    try {
      const payment = await CustomerService.createPayment({
        bookingId,
        paymentMethod: "SANDBOX",
      });
      onSuccess(payment);
    } catch (error: unknown) {
      notifyError(
        "Checkout could not be started",
        error,
        "No payment record was created. Return to your bookings and confirm this rental is still ready for payment.",
        { id: `payment-create-${bookingId}` },
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 py-1">
      <div>
        <h2 className="text-lg font-semibold">Test transaction</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Create a pending payment record for this approved booking, then confirm it in the next step.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-4">
        <div className="rounded-lg bg-background p-2 shadow-sm">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <div className="font-medium">Elite Drive test checkout</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Uses the application payment workflow without contacting an external payment provider.
          </div>
        </div>
      </div>

      <Button className="w-full" onClick={createTestPayment} disabled={submitting}>
        {submitting ? <Loader2 className="animate-spin" /> : <CreditCard />}
        Continue in test mode
      </Button>
    </div>
  );
}
