"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { CustomerService } from "@/features/customer/customer.service";
import type { MomoStatus } from "@/features/customer/customer.schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentResultPage() {
  const [status, setStatus] = useState<MomoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const paymentId = new URLSearchParams(window.location.search).get("paymentId");
    if (!paymentId) {
      setError("Missing local payment reference.");
      return;
    }

    let cancelled = false;
    void CustomerService.getMomoStatus(paymentId)
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Elite Drive could not verify this payment with MoMo yet.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const completed = status?.localStatus === "COMPLETED";

  return (
    <div className="mx-auto w-full max-w-xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Payment status</CardTitle>
          <CardDescription>
            This page verifies the transaction through the Elite Drive backend. Redirect parameters from the browser are not treated as payment proof.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!status && !error ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Verifying payment with MoMo...
            </div>
          ) : null}

          {completed ? (
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5" /> Payment confirmed
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                The provider transaction was verified and the booking payment is complete.
              </p>
            </div>
          ) : null}

          {status && !completed ? (
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 font-semibold">
                <CircleAlert className="h-5 w-5" /> Payment not confirmed
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                MoMo returned: {status.providerMessage}. No successful payment is assumed.
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 font-semibold">
                <CircleAlert className="h-5 w-5" /> Verification unavailable
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </div>
          ) : null}

          <Button asChild className="w-full">
            <Link href="/customer/bookings">Back to bookings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
