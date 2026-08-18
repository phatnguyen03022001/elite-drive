"use client";

import { useEffect, useMemo, useState } from "react";
import { Car, CircleDollarSign, RefreshCw, RotateCcw, Users } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

type RevenueGroup = { status: string; _sum?: { amount?: number | null } };

type State = {
  overview: { totalUsers?: number; totalCars?: number; totalBookings?: number; totalRevenue?: number } | null;
  revenue: RevenueGroup[];
  pendingRelease: number;
};

export default function AdminPlatformFinancePage() {
  const [state, setState] = useState<State>({ overview: null, revenue: [], pendingRelease: 0 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [overviewRes, revenueRes, pendingRes]: any[] = await Promise.all([
        api.get("/api/admin/reports/overview"),
        api.get("/api/admin/reports/revenue"),
        api.get("/api/admin/escrow/pending-release", { params: { page: 1, limit: 1 } }),
      ]);

      setState({
        overview: overviewRes?.data ?? null,
        revenue: Array.isArray(revenueRes?.data) ? revenueRes.data : [],
        pendingRelease: Number(pendingRes?.data?.total ?? 0),
      });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Could not load finance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const totals = useMemo(() => {
    const byStatus = Object.fromEntries(
      state.revenue.map((group) => [group.status, Number(group._sum?.amount || 0)]),
    );
    return {
      completed: byStatus.COMPLETED || 0,
      refunded: byStatus.REFUNDED || 0,
      pending: byStatus.PENDING || 0,
    };
  }, [state.revenue]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Finance</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Payment operations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Recorded payment values, marketplace volume, and completed trips waiting for release. Figures come from persisted payment and booking records rather than a synthetic client balance.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Completed payment value" value={loading ? "—" : currency.format(totals.completed)} icon={<CircleDollarSign />} />
        <Metric label="Refunded payment value" value={loading ? "—" : currency.format(totals.refunded)} icon={<RotateCcw />} />
        <Metric label="Bookings / vehicles" value={loading ? "—" : `${state.overview?.totalBookings ?? 0} / ${state.overview?.totalCars ?? 0}`} icon={<Car />} />
        <Metric label="Users / pending releases" value={loading ? "—" : `${state.overview?.totalUsers ?? 0} / ${state.pendingRelease}`} icon={<Users />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment value by status</CardTitle>
          <CardDescription>
            Backend aggregation of payment amounts grouped by their persisted status. Test-mode payment records are accounting state only; they do not represent processor settlement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Recorded amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}><TableCell colSpan={2}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                  ))
                ) : state.revenue.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="h-28 text-center text-muted-foreground">No payment aggregates are available yet.</TableCell></TableRow>
                ) : (
                  state.revenue.map((group) => (
                    <TableRow key={group.status}>
                      <TableCell><Badge variant="outline">{group.status}</Badge></TableCell>
                      <TableCell className="text-right font-semibold">{currency.format(Number(group._sum?.amount || 0))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardDescription>{label}</CardDescription>
        <div className="text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</div>
      </CardHeader>
      <CardContent><div className="text-2xl font-bold tracking-tight">{value}</div></CardContent>
    </Card>
  );
}
