"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, WalletCards } from "lucide-react";
import { AdminService } from "@/features/admin/admin.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notifyError } from "@/lib/notifications";

type LedgerUser = {
  email?: string | null;
  role?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type WalletLedgerRow = {
  walletId: string;
  userId: string;
  user?: LedgerUser | null;
  currency: string;
  balance: number;
  journalBalance: number;
  drift: number;
  validVnd: boolean;
  isBalanced: boolean;
};

type LedgerResult = {
  items: WalletLedgerRow[];
  total: number;
  page: number;
  limit: number;
  summary: {
    checked: number;
    balanced: number;
    mismatched: number;
    invalidVnd: number;
  };
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export default function AdminWalletReconciliationPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<LedgerResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const limit = 20;

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const data = (await AdminService.getWalletReconciliation({ page, limit })) as LedgerResult;
      setResult(data);
    } catch (error: unknown) {
      notifyError(
        "Wallet reconciliation could not be loaded",
        error,
        "No wallet balances were changed. Retry before investigating a financial mismatch.",
        { id: "admin-wallet-reconciliation" },
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil((result?.total ?? 0) / limit)),
    [result?.total],
  );
  const summary = result?.summary ?? { checked: 0, balanced: 0, mismatched: 0, invalidVnd: 0 };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 py-2">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Finance controls</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Wallet reconciliation</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Compare each mutable wallet balance with the append-only wallet journal. A non-zero drift means the balance cannot be reproduced from recorded money movements and requires investigation.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load(true)} disabled={loading || refreshing}>
          <RefreshCw className={refreshing ? "animate-spin" : ""} />
          Reconcile
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Checked on this page" value={summary.checked} loading={loading} />
        <Metric label="Balanced" value={summary.balanced} loading={loading} />
        <Metric label="Balance drift" value={summary.mismatched} loading={loading} attention={summary.mismatched > 0} />
        <Metric label="Invalid VND" value={summary.invalidVnd} loading={loading} attention={summary.invalidVnd > 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Wallet journal check</CardTitle>
          <CardDescription>
            Historical rows created before complete double-sided journaling may show drift. This screen is read-only and never repairs balances automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Wallet balance</TableHead>
                  <TableHead className="text-right">Journal balance</TableHead>
                  <TableHead className="text-right">Drift</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : (result?.items.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No wallets found.</TableCell>
                  </TableRow>
                ) : (
                  result?.items.map((row) => {
                    const displayName = [row.user?.firstName, row.user?.lastName].filter(Boolean).join(" ");
                    return (
                      <TableRow key={row.walletId}>
                        <TableCell>
                          <div className="font-medium">{displayName || row.user?.email || row.userId}</div>
                          <div className="mt-1 font-mono text-xs text-muted-foreground">{row.walletId}</div>
                        </TableCell>
                        <TableCell>{row.user?.role ?? "—"}</TableCell>
                        <TableCell className="text-right font-medium">{money.format(row.balance)}</TableCell>
                        <TableCell className="text-right">{money.format(row.journalBalance)}</TableCell>
                        <TableCell className="text-right font-medium">{money.format(row.drift)}</TableCell>
                        <TableCell>
                          {row.isBalanced ? (
                            <Badge variant="outline"><CheckCircle2 />Balanced</Badge>
                          ) : (
                            <Badge variant="destructive"><AlertTriangle />{row.validVnd ? "Drift" : "Invalid VND"}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Page {page} of {pageCount} · {result?.total ?? 0} wallets</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pageCount || loading} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, loading, attention = false }: { label: string; value: number; loading: boolean; attention?: boolean }) {
  return (
    <Card className={attention ? "border-destructive/30" : undefined}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardDescription>{label}</CardDescription>
        <WalletCards className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{value}</div>}
      </CardContent>
    </Card>
  );
}
