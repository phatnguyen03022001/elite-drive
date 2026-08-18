"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, History, Loader2, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { OwnerService } from "@/features/owner/owner.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" });
const MIN_WITHDRAWAL = 50_000;

export default function OwnerWalletPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const walletQuery = useQuery({ queryKey: ["owner", "wallet"], queryFn: OwnerService.getWallet, staleTime: 60_000 });
  const transactionsQuery = useQuery({
    queryKey: ["owner", "transactions", 20],
    queryFn: () => OwnerService.getTransactions({ page: 1, limit: 20 }),
    staleTime: 60_000,
  });

  const withdraw = useMutation({
    mutationFn: OwnerService.requestWithdraw,
    onSuccess: async () => {
      toast.success("Withdrawal request submitted");
      setOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["owner", "wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["owner", "transactions"] }),
      ]);
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || error?.message || "Could not submit withdrawal request"),
  });

  const transactions = Array.isArray(transactionsQuery.data) ? transactionsQuery.data : transactionsQuery.data?.data ?? [];
  const refreshing = walletQuery.isFetching || transactionsQuery.isFetching;

  const refresh = async () => {
    await Promise.all([walletQuery.refetch(), transactionsQuery.refetch()]);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Finance</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Owner wallet</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Track rental income, refunds, and withdrawal requests from one ledger.</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={refreshing}><RefreshCw className={refreshing ? "animate-spin" : ""} />Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardDescription>Available balance</CardDescription><CardTitle className="text-4xl tracking-tight">{walletQuery.isLoading ? "—" : currency.format(Number(walletQuery.data?.balance || 0))}</CardTitle></CardHeader>
          <CardContent>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><ArrowDownToLine />Request withdrawal</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Request withdrawal</DialogTitle><DialogDescription>Submit a payout request for operations review. Minimum withdrawal: {currency.format(MIN_WITHDRAWAL)}.</DialogDescription></DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const amount = Number(data.get("amount"));
                    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
                      toast.error(`Minimum withdrawal is ${currency.format(MIN_WITHDRAWAL)}`);
                      return;
                    }
                    withdraw.mutate({
                      amount,
                      bankAccountNumber: String(data.get("accountNumber") || ""),
                      bankAccountName: String(data.get("accountName") || "").trim().toUpperCase(),
                      description: String(data.get("description") || "").trim() || undefined,
                    });
                  }}>
                  <Field label="Amount (VND)"><Input name="amount" type="number" min={MIN_WITHDRAWAL} step="1000" placeholder="500000" required /></Field>
                  <Field label="Account holder"><Input name="accountName" placeholder="NGUYEN VAN A" required /></Field>
                  <Field label="Account number"><Input name="accountNumber" placeholder="Bank account number" required /></Field>
                  <Field label="Note (optional)"><Input name="description" placeholder="Monthly payout" /></Field>
                  <DialogFooter><Button type="submit" disabled={withdraw.isPending}>{withdraw.isPending ? <Loader2 className="animate-spin" /> : <ArrowDownToLine />}Submit request</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><History className="h-5 w-5" /></div><CardDescription>Recent ledger entries</CardDescription><CardTitle className="text-3xl">{transactions.length}</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Showing the latest 20 wallet transactions.</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Wallet className="h-5 w-5" />Transaction ledger</CardTitle><CardDescription>Rental income, refunds, escrow releases, and withdrawal activity.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {walletQuery.isLoading || transactionsQuery.isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">Loading wallet activity...</TableCell></TableRow>
              ) : transactions.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">No wallet transactions yet.</TableCell></TableRow>
              ) : transactions.map((transaction: any) => {
                const amount = Number(transaction.amount || 0);
                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="text-muted-foreground">{dateFormatter.format(new Date(transaction.createdAt))}</TableCell>
                    <TableCell className="font-medium">{transaction.description || "Wallet transaction"}</TableCell>
                    <TableCell><Badge variant="secondary">{String(transaction.type || "TRANSACTION").replaceAll("_", " ")}</Badge></TableCell>
                    <TableCell className="font-semibold">{amount > 0 ? "+" : ""}{currency.format(amount)}</TableCell>
                    <TableCell className="text-right"><Badge variant="outline">{String(transaction.status || "RECORDED").toUpperCase()}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
