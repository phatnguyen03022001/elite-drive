"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { CustomerService } from "@/features/customer/customer.service";
import { Button } from "@/components/ui/button";
import { notify, notifyError } from "@/lib/notifications";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function QrPaymentBox({
  payment,
  bookingId,
}: {
  bookingId: string;
  payment: {
    id: string;
    amount: number;
    transactionId?: string;
  };
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const confirmTestPayment = async () => {
    setConfirming(true);
    try {
      await CustomerService.confirmPayment({
        bookingId,
        transactionId: payment.transactionId || `TEST-${payment.id}`,
      });
      notify.success("Booking confirmed", {
        id: `payment-confirm-${bookingId}`,
        description: "The test payment record is complete and this booking has advanced to the confirmed trip state.",
      });
      router.push("/customer/bookings");
      router.refresh();
    } catch (error: unknown) {
      notifyError(
        "Checkout could not be completed",
        error,
        "The payment state was not confirmed. Keep this page open and try again.",
        { id: `payment-confirm-${bookingId}` },
      );
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6 py-1">
      <div>
        <h2 className="text-lg font-semibold">Confirm test transaction</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Confirmation marks the payment record complete and advances the approved booking into its confirmed trip workflow.
        </p>
      </div>

      <div className="rounded-xl border bg-muted/20 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Amount</div>
            <div className="mt-2 text-2xl font-bold">{currency.format(Number(payment.amount || 0))}</div>
          </div>
          <ShieldCheck className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="mt-5 border-t pt-4 text-xs text-muted-foreground">
          Payment ID <span className="font-mono text-foreground">{payment.id}</span>
        </div>
      </div>

      <Button className="w-full" onClick={confirmTestPayment} disabled={confirming}>
        {confirming ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
        Complete test checkout
      </Button>
    </div>
  );
}
