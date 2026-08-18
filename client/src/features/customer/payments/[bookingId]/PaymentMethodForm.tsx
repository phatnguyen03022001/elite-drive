"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CustomerService } from "@/features/customer/customer.service";
import { Button } from "@/components/ui/button";

export function PaymentMethodForm({ bookingId, onSuccess }: { bookingId: string; onSuccess: (payment: any) => void }) {
  const [submitting, setSubmitting] = useState(false);

  const createSandboxPayment = async () => {
    setSubmitting(true);
    try {
      const payment = await CustomerService.createPayment({
        bookingId,
        paymentMethod: "SANDBOX",
      });
      onSuccess(payment);
    } catch (error: any) {
      toast.error(error?.message || "Could not create the payment record");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 py-1">
      <div>
        <h2 className="text-lg font-semibold">Payment method</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Use the sandbox adapter to validate the booking lifecycle in this public environment.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-4">
        <div className="rounded-lg bg-background p-2 shadow-sm">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <div className="font-medium">Elite Drive payment sandbox</div>
          <div className="mt-1 text-sm text-muted-foreground">Creates a pending payment tied to this booking. No real funds are collected.</div>
        </div>
      </div>

      <Button className="w-full" onClick={createSandboxPayment} disabled={submitting}>
        {submitting ? <Loader2 className="animate-spin" /> : <CreditCard />}
        Create payment record
      </Button>
    </div>
  );
}
