"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, CreditCard, RefreshCw, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Payment = {
  id: string;
  amount: number;
  paymentMethod?: string;
  transactionId?: string | null;
  status: string;
  createdAt: string;
  user?: { firstName?: string; lastName?: string; email?: string };
  booking?: { id: string; status?: string };
};

export default function AdminPaymentLedgerPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response: any = await api.get("/api/admin/payments", { params: { page: 1, limit: 100 } });
      setPayments(Array.isArray(response?.data) ? response.data : []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Could not load payment ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => payments.filter((payment) => {
    const haystack = `${payment.user?.email || ""} ${payment.transactionId || ""} ${payment.id} ${payment.booking?.id || ""}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  }), [payments, search]);
  const completedValue = payments.filter((payment) => payment.status === "COMPLETED").reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Finance</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Payment ledger</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Inspect every recorded payment regardless of payment adapter. The public portfolio uses a sandbox adapter rather than moving real funds.</p></div>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3"><Metric label="Ledger entries" value={String(payments.length)} /><Metric label="Completed value" value={currency.format(completedValue)} /><Metric label="Pending entries" value={String(payments.filter((p) => p.status === "PENDING").length)} /></div>
      <Card><CardHeader className="gap-4"><div><CardTitle className="text-lg">Transactions</CardTitle><CardDescription>Search by customer email, booking ID, payment ID, or transaction reference.</CardDescription></div><div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ledger..." /></div></CardHeader><CardContent><div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead>Amount</TableHead><TableHead>Created</TableHead><TableHead>Status</TableHead><TableHead>Booking</TableHead></TableRow></TableHeader><TableBody>
        {loading ? Array.from({ length: 5 }).map((_, index) => <TableRow key={index}><TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell></TableRow>) : visible.length === 0 ? <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No payments match this search.</TableCell></TableRow> : visible.map((payment) => <TableRow key={payment.id}><TableCell><div className="font-medium">{[payment.user?.firstName, payment.user?.lastName].filter(Boolean).join(" ") || "Customer"}</div><div className="text-xs text-muted-foreground">{payment.user?.email || "—"}</div></TableCell><TableCell><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-muted-foreground" />{payment.paymentMethod || "UNKNOWN"}</div></TableCell><TableCell className="font-mono text-xs">{payment.transactionId || payment.id.slice(-10).toUpperCase()}</TableCell><TableCell className="font-semibold">{currency.format(Number(payment.amount || 0))}</TableCell><TableCell className="text-sm text-muted-foreground">{dateTime.format(new Date(payment.createdAt))}</TableCell><TableCell><Status status={payment.status} /></TableCell><TableCell className="font-mono text-xs">{payment.booking?.id ? `#${payment.booking.id.slice(-8).toUpperCase()}` : "—"}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <Card><CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-2xl">{value}</CardTitle></CardHeader></Card>; }
function Status({ status }: { status: string }) { if (status === "COMPLETED") return <Badge variant="outline"><CheckCircle2 />Completed</Badge>; if (status === "FAILED" || status === "REFUNDED") return <Badge variant="destructive"><XCircle />{status === "REFUNDED" ? "Refunded" : "Failed"}</Badge>; return <Badge variant="secondary"><Clock3 />{status}</Badge>; }
