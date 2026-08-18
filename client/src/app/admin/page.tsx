"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Banknote, Car, CreditCard, Gavel, RefreshCw, ShieldCheck, Vault } from "lucide-react";
import { AdminService } from "@/features/admin/admin.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { notifyError } from "@/lib/notifications";

type CollectionLike = { data?: unknown[]; items?: unknown[]; total?: number };
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

const emptyState: DashboardState = {
  totalUsers: 0,
  totalCars: 0,
  activeBookings: 0,
  platformBalance: 0,
  kycPending: 0,
  carsPending: 0,
  withdrawalsPending: 0,
  disputesOpen: 0,
  releasesPending: 0,
};

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

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
      setError("Một hoặc nhiều hàng đợi vận hành chưa tải được. Không có trạng thái nào bị thay đổi.");
      notifyError("Không thể tải operations dashboard", requestError, "Hãy thử làm mới trước khi thực hiện tác vụ quản trị.", { id: "admin-operations-load" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const attentionTotal = useMemo(
    () => state.kycPending + state.carsPending + state.withdrawalsPending + state.disputesOpen + state.releasesPending,
    [state],
  );

  const queues = [
    ["KYC chờ duyệt", state.kycPending, "/admin/kyc", ShieldCheck, "Identity evidence cần quyết định."],
    ["Xe chờ duyệt", state.carsPending, "/admin/cars", Car, "Nguồn cung chưa được publish."],
    ["Yêu cầu rút tiền", state.withdrawalsPending, "/admin/withdraws", Banknote, "Owner payout cần xử lý."],
    ["Tranh chấp mở", state.disputesOpen, "/admin/disputes", Gavel, "Case cần phản hồi hoặc resolution."],
    ["Escrow chờ release", state.releasesPending, "/admin/escrow", Vault, "Trip hoàn tất đang giữ tiền."],
  ] as const;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Admin operations</p>
            {!loading ? <Badge variant="secondary">{attentionTotal} cần chú ý</Badge> : null}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Operations dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Ưu tiên queue ảnh hưởng trực tiếp tới trust, nguồn cung và dòng tiền thay vì chỉ xem KPI tổng.</p>
        </div>
        <Button variant="outline" onClick={() => void load(true)} disabled={loading || refreshing}><RefreshCw className={refreshing ? "animate-spin" : ""} />Làm mới</Button>
      </div>

      {error ? <Card className="border-destructive/30"><CardHeader><CardTitle className="text-base">Dashboard chưa đầy đủ</CardTitle><CardDescription>{error}</CardDescription></CardHeader><CardContent><Button onClick={() => void load()}>Thử lại</Button></CardContent></Card> : null}

      <section className="space-y-4">
        <div><h2 className="text-xl font-semibold">Needs attention</h2><p className="mt-1 text-sm text-muted-foreground">Mở trực tiếp queue cần xử lý.</p></div>
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
        <div><h2 className="text-xl font-semibold">Platform health</h2><p className="mt-1 text-sm text-muted-foreground">Chỉ số tổng để định hướng; ledger mới là nguồn điều tra giao dịch.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Users" value={state.totalUsers.toLocaleString("vi-VN")} loading={loading} />
          <Metric label="Vehicles" value={state.totalCars.toLocaleString("vi-VN")} loading={loading} />
          <Metric label="Active bookings" value={state.activeBookings.toLocaleString("vi-VN")} loading={loading} />
          <Metric label="Platform wallet" value={money.format(state.platformBalance)} loading={loading} />
        </div>
      </section>

      <Card>
        <CardHeader><CardTitle className="text-lg">Payment operations</CardTitle><CardDescription>MoMo redirect không phải bằng chứng thanh toán. Ledger, escrow và reconciliation là các công cụ điều tra/khôi phục trạng thái.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/admin/reports"><CreditCard />Payment ledger</Link></Button>
          <Button asChild variant="outline"><Link href="/admin/escrow"><Vault />Escrow</Link></Button>
          <Button asChild variant="outline"><Link href="/admin/settlements"><Banknote />Settlements</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return <Card><CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-2xl">{loading ? <Skeleton className="h-8 w-24" /> : value}</CardTitle></CardHeader></Card>;
}
