"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2, RefreshCw, Wallet } from "lucide-react";
import { CustomerService } from "@/features/customer/customer.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { notifyError } from "@/lib/notifications";

type WalletRecord = {
  id: string;
  balance: number;
  currency?: string;
  updatedAt?: string;
};

type WalletTransaction = {
  id: string;
  amount: number;
  type: string;
  description?: string | null;
  createdAt: string;
};

type PaginatedTransactions = {
  data?: WalletTransaction[];
  items?: WalletTransaction[];
  total?: number;
  page?: number;
  limit?: number;
};

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function isCredit(transaction: WalletTransaction) {
  return Number(transaction.amount) > 0 || ["REFUND", "TOPUP", "WITHDRAW_REJECTED"].includes(transaction.type);
}

export default function CustomerWalletPage() {
  const [wallet, setWallet] = useState<WalletRecord | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [walletResult, transactionResult] = await Promise.all([
        CustomerService.getWallet() as Promise<WalletRecord>,
        CustomerService.getWalletTransactions({ page: 1, limit: 50 }) as Promise<PaginatedTransactions>,
      ]);
      setWallet(walletResult);
      setTransactions(transactionResult.data ?? transactionResult.items ?? []);
    } catch (requestError: unknown) {
      setError("Không thể tải ví lúc này. Số dư và lịch sử giao dịch chưa bị thay đổi.");
      notifyError(
        "Không thể tải ví",
        requestError,
        "Hãy thử tải lại. Không có giao dịch nào được thực hiện.",
        { id: "customer-wallet-load" },
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refundTotal = useMemo(
    () => transactions
      .filter((transaction) => transaction.type === "REFUND")
      .reduce((sum, transaction) => sum + Math.max(0, Number(transaction.amount || 0)), 0),
    [transactions],
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Money</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Wallet & refunds</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Theo dõi số dư Elite Drive và toàn bộ khoản hoàn tiền hoặc điều chỉnh đã ghi nhận vào ví của bạn.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load(true)} disabled={loading || refreshing}>
          <RefreshCw className={refreshing ? "animate-spin" : ""} />
          Làm mới
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base">Dữ liệu ví tạm thời không khả dụng</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent><Button onClick={() => void load()}>Thử lại</Button></CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Số dư hiện tại</CardDescription>
            <CardTitle className="text-3xl">
              {loading ? <Skeleton className="h-9 w-40" /> : currency.format(Number(wallet?.balance ?? 0))}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Đơn vị: {wallet?.currency || "VND"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Hoàn tiền gần đây</CardDescription>
            <CardTitle className="text-3xl">
              {loading ? <Skeleton className="h-9 w-32" /> : currency.format(refundTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Tổng trong tối đa 50 giao dịch gần nhất.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Giao dịch hiển thị</CardDescription>
            <CardTitle className="text-3xl">
              {loading ? <Skeleton className="h-9 w-16" /> : transactions.length.toLocaleString("vi-VN")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Lịch sử mới nhất của ví Elite Drive.</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Wallet className="h-5 w-5" />Lịch sử ví</CardTitle>
          <CardDescription>
            Khi booking đủ điều kiện hoàn tiền, khoản hoàn sẽ xuất hiện tại đây. Thanh toán MoMo và ví nội bộ là hai trạng thái tài chính riêng biệt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-12 text-center">
              <Wallet className="mx-auto h-8 w-8 text-muted-foreground" />
              <div className="mt-4 font-semibold">Chưa có giao dịch ví</div>
              <p className="mt-2 text-sm text-muted-foreground">Các khoản hoàn tiền và điều chỉnh số dư sẽ xuất hiện tại đây.</p>
            </div>
          ) : (
            <div className="divide-y rounded-xl border">
              {transactions.map((transaction) => {
                const credit = isCredit(transaction);
                return (
                  <div key={transaction.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rounded-xl bg-muted p-2.5 text-muted-foreground">
                        {credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{transaction.description || "Wallet transaction"}</span>
                          <Badge variant="secondary">{transaction.type}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{dateTime.format(new Date(transaction.createdAt))}</div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-semibold">
                      {credit && Number(transaction.amount) > 0 ? "+" : ""}{currency.format(Number(transaction.amount || 0))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
