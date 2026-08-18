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
      setError("Elite Drive chưa thể xác minh giao dịch này với MoMo. Không có trạng thái thanh toán thành công nào được giả định.");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("paymentId");
    setPaymentId(id);
    if (!id) {
      setError("Thiếu mã tham chiếu payment nội bộ.");
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
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Payment verification</CardTitle>
            <Badge variant="secondary">MoMo sandbox</Badge>
          </div>
          <CardDescription>
            Elite Drive xác minh giao dịch ở backend. Query string từ browser redirect không được dùng làm bằng chứng thanh toán.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {checking ? (
            <div className="flex items-center gap-3 rounded-xl border p-4 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />Đang đối chiếu trạng thái với MoMo...
            </div>
          ) : null}

          {completed ? (
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" />Thanh toán đã xác nhận</div>
              <p className="mt-2 text-sm text-muted-foreground">Provider đã xác nhận giao dịch và booking được ghi nhận thanh toán thành công.</p>
              {status?.providerTransactionId ? <p className="mt-2 font-mono text-xs text-muted-foreground">MoMo transId: {status.providerTransactionId}</p> : null}
            </div>
          ) : null}

          {pending ? (
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 font-semibold"><Clock3 className="h-5 w-5" />Thanh toán đang chờ xác minh</div>
              <p className="mt-2 text-sm text-muted-foreground">MoMo trả về: {status?.providerMessage}. Booking chưa được coi là đã thanh toán cho tới khi backend nhận trạng thái final.</p>
            </div>
          ) : null}

          {failed ? (
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 font-semibold"><CircleAlert className="h-5 w-5" />Thanh toán không thành công</div>
              <p className="mt-2 text-sm text-muted-foreground">MoMo trả về: {status?.providerMessage}. Không có payment success nào được ghi nhận.</p>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-destructive/30 p-4">
              <div className="flex items-center gap-2 font-semibold"><CircleAlert className="h-5 w-5" />Chưa thể xác minh</div>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" disabled={!paymentId || checking} onClick={() => paymentId && void verify(paymentId)}>
              <RefreshCw className={checking ? "animate-spin" : ""} />Kiểm tra lại
            </Button>
            <Button asChild><Link href="/customer/bookings">Về danh sách booking</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
