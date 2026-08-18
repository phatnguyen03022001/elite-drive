"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Eye, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useApproveKyc, useKycCustomers, useRejectKyc } from "@/features/admin/admin.queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" });

export default function AdminKycPage() {
  const [status, setStatus] = useState<string>("PENDING");
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<any>(null);
  const [reason, setReason] = useState("");
  const query = useKycCustomers({ page, limit: 10, status: status === "ALL" ? undefined : status as any });
  const approve = useApproveKyc();
  const reject = useRejectKyc();
  const items = query.data?.items ?? [];
  const total = Number(query.data?.total ?? 0);
  const limit = Number(query.data?.limit ?? 10);
  const pages = Math.max(1, Math.ceil(total / limit));

  const metrics = useMemo(() => ({ total, shown: items.length }), [items.length, total]);

  const approveUser = (item: any) => {
    if (!window.confirm(`Approve identity verification for ${item.user?.email || "this account"}?`)) return;
    approve.mutate({ userId: item.userId }, {
      onSuccess: () => toast.success("Identity verification approved"),
      onError: (error: any) => toast.error(error?.response?.data?.message || "Could not approve verification"),
    });
  };

  const rejectUser = () => {
    if (!rejecting || reason.trim().length < 5) return;
    reject.mutate({ userId: rejecting.userId, dto: { rejectionReason: reason.trim() } }, {
      onSuccess: () => { toast.success("Verification returned for changes"); setRejecting(null); setReason(""); },
      onError: (error: any) => toast.error(error?.response?.data?.message || "Could not reject verification"),
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Trust & safety</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">KYC reviews</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Review customer and owner identity evidence before enabling protected marketplace workflows.</p></div>
        <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All statuses</SelectItem><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="APPROVED">Approved</SelectItem><SelectItem value="REJECTED">Rejected</SelectItem></SelectContent></Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2"><Metric label="Matching records" value={metrics.total} icon={<ShieldCheck />} /><Metric label="Visible on page" value={metrics.shown} icon={<Clock3 />} /></div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Verification queue</CardTitle><CardDescription>Open evidence in a new tab for full-size inspection before taking action.</CardDescription></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Document</TableHead><TableHead>Evidence</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {query.isLoading ? Array.from({ length: 4 }).map((_, index) => <TableRow key={index}><TableCell colSpan={6}><Skeleton className="h-12 w-full" /></TableCell></TableRow>) : items.length === 0 ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No verification records match this filter.</TableCell></TableRow> : items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell><div className="font-medium">{[item.user?.firstName, item.user?.lastName].filter(Boolean).join(" ") || "Account holder"}</div><div className="mt-1 text-xs text-muted-foreground">{item.user?.email}</div><Badge variant="outline" className="mt-2">{item.user?.role || "USER"}</Badge></TableCell>
                    <TableCell><div className="font-medium">{item.documentType || "Identity document"}</div><div className="mt-1 font-mono text-xs text-muted-foreground">{item.documentNumber || "—"}</div></TableCell>
                    <TableCell><div className="flex gap-2"><Evidence src={item.documentFrontUrl} label="Front" /><Evidence src={item.documentBackUrl} label="Back" /><Evidence src={item.faceImageUrl} label="Face" /></div></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.submittedAt ? dateFormatter.format(new Date(item.submittedAt)) : "—"}</TableCell>
                    <TableCell><StatusBadge status={item.status} />{item.rejectionReason ? <p className="mt-2 max-w-48 text-xs leading-5 text-muted-foreground">{item.rejectionReason}</p> : null}</TableCell>
                    <TableCell className="text-right">{item.status === "PENDING" ? <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => { setRejecting(item); setReason(""); }}><XCircle />Reject</Button><Button size="sm" onClick={() => approveUser(item)} disabled={approve.isPending}><CheckCircle2 />Approve</Button></div> : <span className="text-xs text-muted-foreground">Reviewed</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center justify-end gap-3"><Button variant="outline" size="sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage((current) => current - 1)}>Previous</Button><span className="text-sm text-muted-foreground">Page {page} of {pages}</span><Button variant="outline" size="sm" disabled={page >= pages || query.isFetching} onClick={() => setPage((current) => current + 1)}>Next</Button></div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}><DialogContent><DialogHeader><DialogTitle>Reject identity verification</DialogTitle><DialogDescription>Explain what needs to be corrected. The account holder will see this reason before resubmitting.</DialogDescription></DialogHeader><Textarea className="min-h-28" placeholder="Document is unreadable, face image does not match..." value={reason} onChange={(event) => setReason(event.target.value)} /><DialogFooter><Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="destructive" onClick={rejectUser} disabled={reason.trim().length < 5 || reject.isPending}>{reject.isPending ? <Loader2 className="animate-spin" /> : <XCircle />}Reject verification</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardDescription>{label}</CardDescription><div className="[&>svg]:h-4 [&>svg]:w-4 text-muted-foreground">{icon}</div></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>; }
function StatusBadge({ status }: { status: string }) { if (status === "APPROVED") return <Badge variant="outline">Approved</Badge>; if (status === "REJECTED") return <Badge variant="destructive">Rejected</Badge>; return <Badge variant="secondary">Pending</Badge>; }
function Evidence({ src, label }: { src?: string; label: string }) { return <button type="button" disabled={!src} onClick={() => src && window.open(src, "_blank", "noopener,noreferrer")} className="relative h-12 w-12 overflow-hidden rounded-lg border bg-muted/30 disabled:cursor-default">{src ? <><Image src={src} alt={label} fill className="object-cover" unoptimized /><span className="absolute inset-0 flex items-center justify-center bg-background/70 opacity-0 hover:opacity-100"><Eye className="h-4 w-4" /></span></> : <span className="text-[10px] text-muted-foreground">None</span>}</button>; }
