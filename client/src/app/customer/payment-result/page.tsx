"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Clock3, Loader2, RefreshCw } from "lucide-react";
import { CustomerService } from "@/features/customer/customer.service";
import type { MomoStatus } from "@/features/customer/customer.schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentResultPage() {
  const [status, setStatus] = useState<MomoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const verify = useCallback(async (id: string) => {
    setChecking(true);
    setError(null);
    try {
      const result = await CustomerService.getMomoStatus(id);
      setStatus(result);
    } catch {
      setError("Elite Drive could not verify this transaction with MoMo yet. No successful payment state is assumed.");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("paymentId");
    setPaymentId(id);
    if (!id) {
      setError("The local payment reference is missing.");
      setChecking(false);
      return;
    }
    void verify(id);
  }, [verify]);

  const completed = status?.localStatus === "COMPLETED";
  const failed = status?.localStatus === "FAILED";
  const pending = Boolean(status && !completed && !failed);

  return (
    <div className="mx-auto w-full max-w-xl py-10">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2"><CardTitle>Payment verification</CardTitle><Badge variant="secondary">MoMo sandbox</Badge></div>
          <CardDescription>Elite Drive verifies the transaction through the backend. Browser redirect parameters are never treated as payment proof.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {checking ? <div className="flex items-center gap-3 rounded-xl border p-4 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Checking the provider status with MoMo...</div> : null}

          {completed ? <div className="rounded-xl border p-4"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" />Payment confirmed</div><p className="mt-2 text-sm text-muted-foreground">The provider transaction was verified and the booking payment is complete.</p>{status?.providerTransactionId ? <p className="mt-2 font-mono text-xs text-muted-foreground">MoMo transId: {status.providerTransactionId}</p> : null}</div> : null}

          {pending ? <div className="rounded-xl border p-4"><div className="flex items-center gap-2 font-semibold"><Clock3 className="h-5 w-5" />Payment is still pending</div><p className="mt-2 text-sm text-muted-foreground">MoMo returned: {status?.providerMessage}. The booking is not considered paid until the backend receives a final provider state.</p></div> : null}

          {failed ? <div className="rounded-xl border p-4"><div className="flex items-center gap-2 font-semibold"><CircleAlert className="h-5 w-5" />Payment was not completed</div><p className="mt-2 text-sm text-muted-foreground">MoMo returned: {status?.providerMessage}. No successful payment state was recorded.</p></div> : null}

          {error ? <div className="rounded-xl border border-destructive/30 p-4"><div className="flex items-center gap-2 font-semibold"><CircleAlert className="h-5 w-5" />Verification unavailable</div><p className="mt-2 text-sm text-muted-foreground">{error}</p></div> : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" disabled={!paymentId || checking} onClick={() => paymentId && void verify(paymentId)}><RefreshCw className={checking ? "animate-spin" : ""} />Check again</Button>
            <Button asChild><Link href="/customer/bookings">Back to bookings</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
