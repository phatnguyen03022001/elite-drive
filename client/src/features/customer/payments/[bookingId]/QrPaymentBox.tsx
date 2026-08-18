"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { CustomerService } from "@/features/customer/customer.service";
import { Button } from "@/components/ui/button";

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

  const confirmSandboxPayment = async () => {
    setConfirming(true);
    try {
      await CustomerService.confirmPayment({
        bookingId,
        transactionId: payment.transactionId || `SANDBOX-${payment.id}`,
      });
      toast.success("Payment recorded and booking confirmed");
      router.push("/customer/bookings");
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Could not confirm the payment");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6 py-1">
      <div>
        <h2 className="text-lg font-semibold">Confirm sandbox transaction</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Confirmation runs the backend transaction that marks the payment complete, moves the booking to confirmed,
          records escrow, and creates the upcoming trip.
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

      <Button className="w-full" onClick={confirmSandboxPayment} disabled={confirming}>
        {confirming ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
        Complete sandbox payment
      </Button>
    </div>
  );
}
