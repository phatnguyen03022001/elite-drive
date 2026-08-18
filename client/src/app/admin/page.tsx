"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Banknote, Car, CreditCard, Gavel, Loader2, RefreshCw, ShieldCheck, Vault } from "lucide-react";
import api from "@/lib/axios";
import { AdminService } from "@/features/admin/admin.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { notify, notifyError } from "@/lib/notifications";

type CollectionLike = { data?: unknown[]; items?: unknown[]; total?: number };
type ReconcileSummary = { scanned?: number; completed?: number; failed?: number; pending?: number };
type DashboardState = {
  totalUsers: number;
  totalCars: number;
  activeBookings: number;
  platformBalance: number;
  kycPending: number;
  carsPending: number;
  withdrawalsPending: number;
  disputesOpen: number;
  releasesPending: number;
};

const emptyState: DashboardState = { totalUsers: 0, totalCars: 0, activeBookings: 0, platformBalance: 0, kycPending: 0, carsPending: 0, withdrawalsPending: 0, disputesOpen: 0, releasesPending: 0 };
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

function collectionCount(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== "object") return 0;
  const result = value as CollectionLike;
  if (typeof result.total === "number") return result.total;
  if (Array.isArray(result.items)) return result.items.length;
  if (Array.isArray(result.data)) return result.data.length;
  return 0;
}

export default function AdminOperationsDashboardPage() {
  const [state, setState] = useState(emptyState);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [overview, kyc, cars, withdrawals, disputes, releases, wallet] = await Promise.all([
        AdminService.getOverviewReport(),
        AdminService.getKycCustomers({ page: 1, limit: 1, status: "PENDING" }),
        AdminService.getPendingCars(),
        AdminService.getPendingWithdraws({ page: 1, limit: 1 }),
        AdminService.getDisputes({ page: 1, limit: 1, status: "OPEN" }),
        AdminService.getPendingReleaseTrips({ page: 1, limit: 1 }),
        AdminService.getPlatformWallet(),
      ]);
      setState({
        totalUsers: Number(overview?.totalUsers ?? 0),
        totalCars: Number(overview?.totalCars ?? 0),
        activeBookings: Number(overview?.activeBookings ?? 0),
        platformBalance: Number(wallet?.balance ?? 0),
        kycPending: collectionCount(kyc),
        carsPending: collectionCount(cars),
        withdrawalsPending: collectionCount(withdrawals),
        disputesOpen: collectionCount(disputes),
        releasesPending: collectionCount(releases),
      });
    } catch (requestError: unknown) {
      setError("One or more operational queues could not be loaded. No administrative state was changed.");
      notifyError("Operations dashboard could not be loaded", requestError, "Refresh the dashboard before taking administrative action.", { id: "admin-operations-load" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const attentionTotal = useMemo(() => state.kycPending + state.carsPending + state.withdrawalsPending + state.disputesOpen + state.releasesPending, [state]);

  const runReconciliation = async () => {
    if (!window.confirm("Reconcile pending MoMo payments with the provider now?")) return;
    setReconciling(true);
    try {
      const response = await api.post("/api/admin/payments/momo/reconcile?limit=100") as { data?: ReconcileSummary };
      const result = response.data ?? {};
      notify.success("MoMo reconciliation completed", {
        id: "admin-momo-reconcile",
        description: `Scanned ${result.scanned ?? 0}; completed ${result.completed ?? 0}; failed ${result.failed ?? 0}; still pending ${result.pending ?? 0}.`,
      });
      await load(true);
    } catch (requestError: unknown) {
      notifyError("MoMo reconciliation failed", requestError, "No redirect is treated as payment proof. Retry when the provider is available.", { id: "admin-momo-reconcile" });
    } finally {
      setReconciling(false);
    }
  };

  const queues = [
    ["KYC awaiting review", state.kycPending, "/admin/kyc", ShieldCheck, "Identity evidence needs a decision."],
    ["Vehicles awaiting review", state.carsPending, "/admin/cars", Car, "Supply cannot be published yet."],
    ["Withdrawal requests", state.withdrawalsPending, "/admin/withdraws", Banknote, "Owner payouts need processing."],
    ["Open disputes", state.disputesOpen, "/admin/disputes", Gavel, "Cases need a response or resolution."],
    ["Escrow awaiting release", state.releasesPending, "/admin/escrow", Vault, "Completed trips are still holding funds."],
  ] as const;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 py-2">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Admin operations</p>{!loading ? <Badge variant="secondary">{attentionTotal} need attention</Badge> : null}</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Operations dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Prioritize queues that affect marketplace trust, supply and money movement instead of treating the admin area as a passive KPI dashboard.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load(true)} disabled={loading || refreshing}><RefreshCw className={refreshing ? "animate-spin" : ""} />Refresh</Button>
          <Button onClick={() => void runReconciliation()} disabled={reconciling}>{reconciling ? <Loader2 className="animate-spin" /> : <CreditCard />}Reconcile MoMo</Button>
        </div>
      </div>

      {error ? <Card className="border-destructive/30"><CardHeader><CardTitle className="text-base">Dashboard is incomplete</CardTitle><CardDescription>{error}</CardDescription></CardHeader><CardContent><Button onClick={() => void load()}>Try again</Button></CardContent></Card> : null}

      <section className="space-y-4">
        <div><h2 className="text-xl font-semibold">Needs attention</h2><p className="mt-1 text-sm text-muted-foreground">Open the operational queue directly and resolve the item at its source.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {queues.map(([title, value, href, Icon, description]) => (
            <Link key={href} href={href} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="h-full transition-colors group-hover:border-foreground/20 group-hover:bg-muted/30">
                <CardHeader className="gap-3"><div className="flex items-center justify-between"><div className="rounded-xl bg-muted p-2.5 text-muted-foreground"><Icon className="h-5 w-5" /></div><ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></div><CardDescription>{title}</CardDescription><CardTitle className="text-3xl">{loading ? <Skeleton className="h-9 w-12" /> : value}</CardTitle></CardHeader>
                <CardContent className="text-xs leading-5 text-muted-foreground">{description}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div><h2 className="text-xl font-semibold">Platform health</h2><p className="mt-1 text-sm text-muted-foreground">High-level indicators provide direction; payment and wallet ledgers remain the investigation source.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Users" value={state.totalUsers.toLocaleString("en-US")} loading={loading} />
          <Metric label="Vehicles" value={state.totalCars.toLocaleString("en-US")} loading={loading} />
          <Metric label="Active bookings" value={state.activeBookings.toLocaleString("en-US")} loading={loading} />
          <Metric label="Platform wallet" value={money.format(state.platformBalance)} loading={loading} />
        </div>
      </section>

      <Card>
        <CardHeader><CardTitle className="text-lg">Payment operations</CardTitle><CardDescription>A MoMo redirect is never payment proof. Use the ledger for transaction investigation, escrow for held funds, and reconciliation for stale provider states.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/admin/reports"><CreditCard />Payment ledger</Link></Button><Button asChild variant="outline"><Link href="/admin/escrow"><Vault />Escrow</Link></Button><Button asChild variant="outline"><Link href="/admin/settlements"><Banknote />Settlements</Link></Button></CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return <Card><CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-2xl">{loading ? <Skeleton className="h-8 w-24" /> : value}</CardTitle></CardHeader></Card>;
}
