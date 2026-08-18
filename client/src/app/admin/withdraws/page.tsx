"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" });

type WithdrawRequest = {
  id: string;
  amount: number;
  status: string;
  description?: string;
  metadata?: { bankAccountNumber?: string; bankAccountName?: string };
  createdAt: string;
  owner?: { firstName?: string; lastName?: string; email?: string; avatar?: string };
};

export default function AdminWithdrawalsPage() {
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<WithdrawRequest | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response: any = await api.get("/api/admin/withdraws/pending", { params: { page: 1, limit: 100 } });
      setRequests(Array.isArray(response?.data?.items) ? response.data.items : []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Could not load withdrawal requests");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const approve = async (request: WithdrawRequest) => {
    if (!window.confirm(`Confirm this ${currency.format(Number(request.amount || 0))} withdrawal as approved?`)) return;
    setProcessing(request.id);
    try { await api.post(`/api/admin/withdraws/${request.id}/approve`); toast.success("Withdrawal approved"); await load(); }
    catch (error: any) { toast.error(error?.response?.data?.message || error?.message || "Could not approve withdrawal"); }
    finally { setProcessing(null); }
  };
  const reject = async () => {
    if (!rejecting || reason.trim().length < 5) return;
    setProcessing(rejecting.id);
    try { await api.post(`/api/admin/withdraws/${rejecting.id}/reject`, { reason: reason.trim() }); toast.success("Withdrawal rejected and funds returned to owner wallet"); setRejecting(null); setReason(""); await load(); }
    catch (error: any) { toast.error(error?.response?.data?.message || error?.message || "Could not reject withdrawal"); }
    finally { setProcessing(null); }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Finance</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Withdrawal approvals</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Review owner payout requests that have already reserved funds from the owner wallet.</p></div><div className="flex items-center gap-2"><Badge variant="secondary">{requests.length} pending</Badge><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button></div></div>
      <Card><CardHeader><CardTitle className="text-lg">Pending requests</CardTitle><CardDescription>Approve only after external payout verification; rejecting returns the reserved amount to the owner wallet through the backend transaction.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>Owner</TableHead><TableHead>Payout account</TableHead><TableHead>Amount</TableHead><TableHead>Requested</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
        {loading ? Array.from({ length: 4 }).map((_, index) => <TableRow key={index}><TableCell colSpan={5}><Skeleton className="h-12 w-full" /></TableCell></TableRow>) : requests.length === 0 ? <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No withdrawal requests are waiting for review.</TableCell></TableRow> : requests.map((request) => <TableRow key={request.id}><TableCell><div className="flex items-center gap-3"><div className="relative h-10 w-10 overflow-hidden rounded-full border bg-muted">{request.owner?.avatar ? <Image src={request.owner.avatar} alt="Owner avatar" fill className="object-cover" unoptimized /> : null}</div><div><div className="font-medium">{[request.owner?.firstName, request.owner?.lastName].filter(Boolean).join(" ") || "Owner"}</div><div className="text-xs text-muted-foreground">{request.owner?.email || "—"}</div></div></div></TableCell><TableCell><div className="font-medium">{request.metadata?.bankAccountName || "—"}</div><div className="mt-1 font-mono text-xs text-muted-foreground">{request.metadata?.bankAccountNumber || "—"}</div></TableCell><TableCell className="font-semibold">{currency.format(Number(request.amount || 0))}</TableCell><TableCell className="text-sm text-muted-foreground">{dateFormatter.format(new Date(request.createdAt))}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => { setRejecting(request); setReason(""); }} disabled={Boolean(processing)}><XCircle />Reject</Button><Button size="sm" onClick={() => approve(request)} disabled={Boolean(processing)}>{processing === request.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}Approve</Button></div></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}><DialogContent><DialogHeader><DialogTitle>Reject withdrawal request</DialogTitle><DialogDescription>Give the owner a specific reason. The backend will restore the reserved balance when this request is rejected.</DialogDescription></DialogHeader><Textarea className="min-h-28" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Bank account details could not be verified..." /><DialogFooter><Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="destructive" onClick={reject} disabled={reason.trim().length < 5 || Boolean(processing)}>{processing === rejecting?.id ? <Loader2 className="animate-spin" /> : <XCircle />}Reject request</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
