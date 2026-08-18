"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, RotateCcw, Zap } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

type PendingTrip = { id: string; bookingId: string; updatedAt?: string; booking?: { totalPrice?: number; customer?: { firstName?: string; lastName?: string }; payments?: any[] }; car?: { name?: string; owner?: { firstName?: string; lastName?: string } } };
type Payment = { id: string; bookingId?: string; amount: number; status: string; createdAt: string; user?: { firstName?: string; lastName?: string } };

export default function AdminSettlementsPage() {
  const [pending, setPending] = useState<PendingTrip[]>([]);
  const [history, setHistory] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [pendingRes, paymentRes]: any[] = await Promise.all([
        api.get("/api/admin/escrow/pending-release", { params: { page: 1, limit: 100 } }),
        api.get("/api/admin/payments", { params: { page: 1, limit: 100 } }),
      ]);
      setPending(Array.isArray(pendingRes?.data?.items) ? pendingRes.data.items : []);
      setHistory(Array.isArray(paymentRes?.data) ? paymentRes.data : []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Could not load settlement data");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const run = async (key: string, request: () => Promise<any>, success: string) => {
    setAction(key);
    try { await request(); toast.success(success); await load(); }
    catch (error: any) { toast.error(error?.response?.data?.message || error?.message || "Settlement action failed"); }
    finally { setAction(null); }
  };

  const release = (trip: PendingTrip) => {
    if (!window.confirm(`Release the completed booking ${trip.bookingId} using the backend settlement policy?`)) return;
    void run(`release:${trip.bookingId}`, () => api.post("/api/admin/payments/release", { bookingId: trip.bookingId }), "Payment released to owner wallet");
  };
  const refund = (trip: PendingTrip) => {
    if (!window.confirm(`Refund 100% of booking ${trip.bookingId} to the customer wallet?`)) return;
    void run(`refund:${trip.bookingId}`, () => api.post("/api/admin/payments/refund", { bookingId: trip.bookingId, refundPercent: 100, reason: "Operations full refund" }), "Customer refund recorded");
  };
  const autoRelease = () => {
    if (!window.confirm("Release every completed trip that currently satisfies the backend settlement checks?")) return;
    void run("auto", () => api.post("/api/admin/settlements/auto-release"), "Eligible completed trips processed");
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Finance</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Settlements</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Release completed-trip payments to owner wallets or record customer refunds. Fee calculation remains in the backend settlement service.</p></div><div className="flex gap-2"><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button><Button onClick={autoRelease} disabled={Boolean(action) || pending.length === 0}>{action === "auto" ? <Loader2 className="animate-spin" /> : <Zap />}Auto-release eligible</Button></div></div>
      <Tabs defaultValue="pending"><TabsList><TabsTrigger value="pending">Pending release ({pending.length})</TabsTrigger><TabsTrigger value="history">Payment history</TabsTrigger></TabsList>
        <TabsContent value="pending" className="mt-5"><Card><CardHeader><CardTitle className="text-lg">Completed trips awaiting settlement</CardTitle><CardDescription>Only backend-qualified completed trips appear in this queue.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>Booking</TableHead><TableHead>Vehicle / owner</TableHead><TableHead>Customer</TableHead><TableHead>Booking total</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{loading ? Array.from({ length: 4 }).map((_, index) => <TableRow key={index}><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>) : pending.length === 0 ? <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No completed trips are waiting for release.</TableCell></TableRow> : pending.map((trip) => <TableRow key={trip.id}><TableCell className="font-mono text-xs">#{trip.bookingId.slice(-8).toUpperCase()}</TableCell><TableCell><div className="font-medium">{trip.car?.name || "Vehicle"}</div><div className="text-xs text-muted-foreground">{[trip.car?.owner?.firstName, trip.car?.owner?.lastName].filter(Boolean).join(" ") || "Owner"}</div></TableCell><TableCell>{[trip.booking?.customer?.firstName, trip.booking?.customer?.lastName].filter(Boolean).join(" ") || "Customer"}</TableCell><TableCell className="font-semibold">{currency.format(Number(trip.booking?.totalPrice || 0))}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={Boolean(action)} onClick={() => refund(trip)}>{action === `refund:${trip.bookingId}` ? <Loader2 className="animate-spin" /> : <RotateCcw />}Refund</Button><Button size="sm" disabled={Boolean(action)} onClick={() => release(trip)}>{action === `release:${trip.bookingId}` ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}Release</Button></div></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></TabsContent>
        <TabsContent value="history" className="mt-5"><Card><CardHeader><CardTitle className="text-lg">Payment records</CardTitle><CardDescription>Recorded payment state after booking checkout and settlement actions.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>Created</TableHead><TableHead>Booking</TableHead><TableHead>Customer</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{history.length === 0 && !loading ? <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">No payment records yet.</TableCell></TableRow> : history.map((payment) => <TableRow key={payment.id}><TableCell className="text-sm text-muted-foreground">{dateTime.format(new Date(payment.createdAt))}</TableCell><TableCell className="font-mono text-xs">{payment.bookingId ? `#${payment.bookingId.slice(-8).toUpperCase()}` : "—"}</TableCell><TableCell>{[payment.user?.firstName, payment.user?.lastName].filter(Boolean).join(" ") || "Customer"}</TableCell><TableCell className="font-semibold">{currency.format(Number(payment.amount || 0))}</TableCell><TableCell><Badge variant="outline">{payment.status}</Badge></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
