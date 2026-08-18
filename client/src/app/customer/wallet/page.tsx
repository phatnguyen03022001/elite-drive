"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Wallet } from "lucide-react";
import { CustomerService } from "@/features/customer/customer.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { notifyError } from "@/lib/notifications";

type WalletRecord = { id: string; balance: number; currency?: string; updatedAt?: string };
type WalletTransaction = { id: string; amount: number; type: string; description?: string | null; createdAt: string };
type PaginatedTransactions = { data?: WalletTransaction[]; items?: WalletTransaction[]; total?: number; page?: number; limit?: number };

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

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
      setError("Wallet data is temporarily unavailable. Your balance and transaction history have not been changed.");
      notifyError("Wallet could not be loaded", requestError, "Try again in a moment. No wallet transaction was performed.", { id: "customer-wallet-load" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const refundTotal = useMemo(
    () => transactions.filter((transaction) => transaction.type === "REFUND").reduce((sum, transaction) => sum + Math.max(0, Number(transaction.amount || 0)), 0),
    [transactions],
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Money</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Wallet & refunds</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Track your Elite Drive balance and every refund or balance adjustment recorded against your account.</p>
        </div>
        <Button variant="outline" onClick={() => void load(true)} disabled={loading || refreshing}><RefreshCw className={refreshing ? "animate-spin" : ""} />Refresh</Button>
      </div>

      {error ? <Card className="border-destructive/30"><CardHeader><CardTitle className="text-base">Wallet data is unavailable</CardTitle><CardDescription>{error}</CardDescription></CardHeader><CardContent><Button onClick={() => void load()}>Try again</Button></CardContent></Card> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Current balance</CardDescription><CardTitle className="text-3xl">{loading ? <Skeleton className="h-9 w-40" /> : currency.format(Number(wallet?.balance ?? 0))}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Currency: {wallet?.currency || "VND"}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Recent refunds</CardDescription><CardTitle className="text-3xl">{loading ? <Skeleton className="h-9 w-32" /> : currency.format(refundTotal)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Total across up to the 50 latest wallet transactions.</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Visible transactions</CardDescription><CardTitle className="text-3xl">{loading ? <Skeleton className="h-9 w-16" /> : transactions.length.toLocaleString("en-US")}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Most recent Elite Drive wallet activity.</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Wallet className="h-5 w-5" />Wallet history</CardTitle><CardDescription>Eligible booking refunds appear here after they are recorded. MoMo provider state and the internal Elite Drive wallet are intentionally represented as separate financial states.</CardDescription></CardHeader>
        <CardContent>
          {loading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div> : transactions.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-12 text-center"><Wallet className="mx-auto h-8 w-8 text-muted-foreground" /><div className="mt-4 font-semibold">No wallet activity yet</div><p className="mt-2 text-sm text-muted-foreground">Refunds and balance adjustments will appear here once recorded.</p></div>
          ) : (
            <div className="divide-y rounded-xl border">
              {transactions.map((transaction) => {
                const credit = isCredit(transaction);
                return <div key={transaction.id} className="flex items-center justify-between gap-4 p-4"><div className="flex min-w-0 items-center gap-3"><div className="rounded-xl bg-muted p-2.5 text-muted-foreground">{credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{transaction.description || "Wallet transaction"}</span><Badge variant="secondary">{transaction.type}</Badge></div><div className="mt-1 text-xs text-muted-foreground">{dateTime.format(new Date(transaction.createdAt))}</div></div></div><div className="shrink-0 text-right font-semibold">{credit && Number(transaction.amount) > 0 ? "+" : ""}{currency.format(Number(transaction.amount || 0))}</div></div>;
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
