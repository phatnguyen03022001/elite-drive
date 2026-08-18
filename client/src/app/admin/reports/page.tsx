"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, CreditCard, RefreshCw, Search, XCircle } from "lucide-react";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notifyError } from "@/lib/notifications";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
type Payment = {
  id: string;
  amount: number;
  paymentMethod?: string;
  transactionId?: string | null;
  status: PaymentStatus;
  createdAt: string;
  user?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null;
  booking?: { id: string; status?: string } | null;
};

type PaymentPage = { data?: Payment[]; items?: Payment[]; total?: number };
type ApiEnvelope<T> = { data?: T };

function errorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "Could not load payment ledger";
  const candidate = error as { message?: string; response?: { data?: { message?: string } } };
  return candidate.response?.data?.message || candidate.message || "Could not load payment ledger";
}

export default function AdminPaymentLedgerPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/api/admin/payments", { params: { page: 1, limit: 100 } }) as ApiEnvelope<Payment[] | PaymentPage>;
      const payload = response.data;
      if (Array.isArray(payload)) {
        setPayments(payload);
        setTotal(payload.length);
      } else {
        const items = payload?.data ?? payload?.items ?? [];
        setPayments(items);
        setTotal(Number(payload?.total ?? items.length));
      }
    } catch (error: unknown) {
      notifyError("Payment ledger could not be loaded", error, errorMessage(error), { id: "admin-payment-ledger-load" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => payments.filter((payment) => {
    const haystack = `${payment.user?.email || ""} ${payment.transactionId || ""} ${payment.id} ${payment.booking?.id || ""}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  }), [payments, search]);

  const completedValue = useMemo(() => payments.filter((payment) => payment.status === "COMPLETED").reduce((sum, payment) => sum + Number(payment.amount || 0), 0), [payments]);
  const pendingEntries = useMemo(() => payments.filter((payment) => payment.status === "PENDING").length, [payments]);
  const momoPending = useMemo(() => payments.filter((payment) => payment.status === "PENDING" && payment.paymentMethod?.toUpperCase() === "MOMO").length, [payments]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Finance</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Payment ledger</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Inspect local payment state across booking transactions. MoMo sandbox records represent provider-integrated test transactions; development mock records never represent external settlement.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Ledger entries" value={String(total)} />
        <Metric label="Completed recorded value" value={currency.format(completedValue)} />
        <Metric label="Pending entries" value={String(pendingEntries)} />
        <Metric label="Pending MoMo" value={String(momoPending)} />
      </div>

      {momoPending > 0 ? (
        <Card className="border-dashed">
          <CardHeader><CardTitle className="text-base">Provider follow-up may be required</CardTitle><CardDescription>{momoPending} visible MoMo payment{momoPending === 1 ? " is" : "s are"} still pending. Use the Operations dashboard reconciliation action to query provider state without trusting browser redirects.</CardDescription></CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="gap-4">
          <div><CardTitle className="text-lg">Transactions</CardTitle><CardDescription>Search by customer email, booking ID, payment ID, or merchant transaction reference.</CardDescription></div>
          <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input aria-label="Search payment ledger" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions..." /></div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead>Amount</TableHead><TableHead>Created</TableHead><TableHead>Status</TableHead><TableHead>Booking</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }).map((_, index) => <TableRow key={index}><TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell></TableRow>) : visible.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">{search.trim() ? "No payment records match this search." : "No payment records are available yet."}</TableCell></TableRow>
                ) : visible.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell><div className="font-medium">{[payment.user?.firstName, payment.user?.lastName].filter(Boolean).join(" ") || "Customer"}</div><div className="text-xs text-muted-foreground">{payment.user?.email || "—"}</div></TableCell>
                    <TableCell><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-muted-foreground" />{payment.paymentMethod || "UNKNOWN"}</div></TableCell>
                    <TableCell className="font-mono text-xs">{payment.transactionId || payment.id.slice(-10).toUpperCase()}</TableCell>
                    <TableCell className="font-semibold">{currency.format(Number(payment.amount || 0))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{dateTime.format(new Date(payment.createdAt))}</TableCell>
                    <TableCell><Status status={payment.status} /></TableCell>
                    <TableCell className="font-mono text-xs">{payment.booking?.id ? `#${payment.booking.id.slice(-8).toUpperCase()}` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card><CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-2xl">{value}</CardTitle></CardHeader></Card>;
}

function Status({ status }: { status: PaymentStatus }) {
  if (status === "COMPLETED") return <Badge variant="outline"><CheckCircle2 />Completed</Badge>;
  if (status === "FAILED" || status === "REFUNDED") return <Badge variant="destructive"><XCircle />{status === "REFUNDED" ? "Refunded" : "Failed"}</Badge>;
  return <Badge variant="secondary"><Clock3 />{status}</Badge>;
}
