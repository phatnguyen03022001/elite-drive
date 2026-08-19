"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import api from "@/lib/axios";
import { ApproveWithdrawSchema } from "@/features/admin/admin.schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" });

const WithdrawRequestSchema = z.object({
  id: z.string(),
  amount: z.number(),
  status: z.string(),
  description: z.string().nullable().optional(),
  metadata: z.object({
    bankAccountNumber: z.string().optional(),
    bankAccountName: z.string().optional(),
  }).nullable().optional(),
  createdAt: z.string(),
  owner: z.object({
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
  }).optional(),
});

const PendingWithdrawResponseSchema = z.object({
  data: z.object({
    items: z.array(WithdrawRequestSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
  }),
});

type WithdrawRequest = z.infer<typeof WithdrawRequestSchema>;

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function AdminWithdrawalsPage() {
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [approving, setApproving] = useState<WithdrawRequest | null>(null);
  const [reference, setReference] = useState("");
  const [rejecting, setRejecting] = useState<WithdrawRequest | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = PendingWithdrawResponseSchema.parse(
        await api.get("/api/admin/withdraws/pending", {
          params: { page: 1, limit: 100 },
        }),
      );
      setRequests(response.data.items);
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not load withdrawal requests"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const approve = async () => {
    if (!approving) return;
    const parsed = ApproveWithdrawSchema.safeParse({ externalReference: reference });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Enter a valid payout reference");
      return;
    }

    setProcessing(approving.id);
    try {
      await api.post(`/api/admin/withdraws/${approving.id}/approve`, parsed.data);
      toast.success("Withdrawal payout recorded and approved");
      setApproving(null);
      setReference("");
      await load();
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not approve withdrawal"));
    } finally {
      setProcessing(null);
    }
  };

  const reject = async () => {
    if (!rejecting || reason.trim().length < 5) return;
    setProcessing(rejecting.id);
    try {
      await api.post(`/api/admin/withdraws/${rejecting.id}/reject`, {
        reason: reason.trim(),
      });
      toast.success("Withdrawal rejected and funds returned to owner wallet");
      setRejecting(null);
      setReason("");
      await load();
    } catch (error: unknown) {
      toast.error(messageFromError(error, "Could not reject withdrawal"));
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Finance</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Withdrawal approvals</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review owner payout requests that have already reserved funds from the owner wallet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{requests.length} pending</Badge>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending requests</CardTitle>
          <CardDescription>
            Approve only after the external transfer has completed and record its bank/payment reference. Rejecting restores the reserved amount through the backend journal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Payout account</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={5}><Skeleton className="h-12 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No withdrawal requests are waiting for review.
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 overflow-hidden rounded-full border bg-muted">
                            {request.owner?.avatar ? (
                              <Image src={request.owner.avatar} alt="Owner avatar" fill className="object-cover" unoptimized />
                            ) : null}
                          </div>
                          <div>
                            <div className="font-medium">
                              {[request.owner?.firstName, request.owner?.lastName].filter(Boolean).join(" ") || "Owner"}
                            </div>
                            <div className="text-xs text-muted-foreground">{request.owner?.email || "—"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{request.metadata?.bankAccountName || "—"}</div>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">{request.metadata?.bankAccountNumber || "—"}</div>
                      </TableCell>
                      <TableCell className="font-semibold">{currency.format(request.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{dateFormatter.format(new Date(request.createdAt))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejecting(request);
                              setReason("");
                            }}
                            disabled={Boolean(processing)}>
                            <XCircle />Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setApproving(request);
                              setReference("");
                            }}
                            disabled={Boolean(processing)}>
                            {processing === request.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                            Approve
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(approving)}
        onOpenChange={(open) => {
          if (!open) {
            setApproving(null);
            setReference("");
          }
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm external payout</DialogTitle>
            <DialogDescription>
              Enter the bank or payment-provider reference only after the transfer has actually completed. This reference becomes part of the withdrawal audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="payout-reference" className="text-sm font-medium">Payout reference</label>
            <Input
              id="payout-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="BANK-20260819-000123"
              maxLength={200}
              autoComplete="off"
            />
            {approving ? (
              <p className="text-xs text-muted-foreground">
                Amount: {currency.format(approving.amount)} · Owner: {approving.owner?.email || "unknown"}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproving(null)}>Cancel</Button>
            <Button onClick={() => void approve()} disabled={Boolean(processing) || reference.trim().length < 3}>
              {processing === approving?.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Record payout & approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(rejecting)}
        onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject withdrawal request</DialogTitle>
            <DialogDescription>
              Give the owner a specific reason. The backend will restore the reserved balance when this request is rejected.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-28"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Bank account details could not be verified..."
            maxLength={1000}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => void reject()}
              disabled={reason.trim().length < 5 || Boolean(processing)}>
              {processing === rejecting?.id ? <Loader2 className="animate-spin" /> : <XCircle />}
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
