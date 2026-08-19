"use client";

import Image from "next/image";
import { useState } from "react";
import { CheckCircle2, Clock3, Eye, Loader2, Search, ShieldCheck, XCircle } from "lucide-react";
import { useAllCars, useApproveCar, usePendingCars, useRejectCar } from "@/features/admin/admin.queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { notify, notifyError } from "@/lib/notifications";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" });

type AdminCar = {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  licensePlate?: string;
  verificationStatus?: string;
  mainImageUrl?: string | null;
  pricePerDay?: number;
  createdAt?: string | Date;
  year?: number;
  seatCount?: number;
  description?: string | null;
  owner?: { firstName?: string | null; lastName?: string | null; email?: string | null };
};

export default function AdminCarsPage() {
  const pendingQuery = usePendingCars();
  const allQuery = useAllCars();
  const approve = useApproveCar();
  const reject = useRejectCar();
  const [tab, setTab] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminCar | null>(null);
  const [rejecting, setRejecting] = useState<AdminCar | null>(null);
  const [reason, setReason] = useState("");

  const allCars: AdminCar[] = Array.isArray(allQuery.data)
    ? allQuery.data
    : allQuery.data?.data ?? [];
  const pendingCars: AdminCar[] = Array.isArray(pendingQuery.data)
    ? pendingQuery.data
    : pendingQuery.data?.data ?? [];
  const source =
    tab === "PENDING"
      ? pendingCars
      : tab === "ALL"
        ? allCars
        : allCars.filter((car) => car.verificationStatus === tab);
  const visible = source.filter((car) =>
    `${car.name} ${car.brand ?? ""} ${car.model ?? ""} ${car.licensePlate ?? ""} ${car.owner?.email ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const counts = {
    pending: pendingCars.length,
    approved: allCars.filter((car) => car.verificationStatus === "APPROVED").length,
    rejected: allCars.filter((car) => car.verificationStatus === "REJECTED").length,
    total: allCars.length,
  };

  const refresh = async () => Promise.all([pendingQuery.refetch(), allQuery.refetch()]);

  const approveCar = (car: AdminCar) => {
    if (!window.confirm(`Approve ${car.name} for marketplace availability?`)) return;
    approve.mutate(car.id, {
      onSuccess: async () => {
        notify.success("Vehicle approved", {
          id: `admin-car-${car.id}`,
          description: "The listing can now appear in marketplace discovery when its operational state allows it.",
        });
        await refresh();
      },
      onError: (error: unknown) =>
        notifyError(
          "Vehicle could not be approved",
          error,
          "No vehicle review state was changed. Refresh the queue and try again.",
          { id: `admin-car-${car.id}` },
        ),
    });
  };

  const rejectCar = () => {
    if (!rejecting) return;
    if (reason.trim().length < 5) {
      notify.warning("Add a review note", {
        id: "admin-car-validation",
        description: "Explain what the owner needs to correct before this vehicle can be approved.",
      });
      return;
    }

    reject.mutate(
      { carId: rejecting.id, reason: reason.trim() },
      {
        onSuccess: async () => {
          notify.success("Vehicle returned for changes", {
            id: `admin-car-${rejecting.id}`,
            description: "The owner can update the listing and submit it for another review.",
          });
          setRejecting(null);
          setReason("");
          await refresh();
        },
        onError: (error: unknown) =>
          notifyError(
            "Vehicle could not be returned",
            error,
            "No vehicle review state was changed. Review the note and try again.",
            { id: `admin-car-${rejecting.id}` },
          ),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 py-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Trust & supply</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Vehicle approvals</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Review fleet submissions before they become bookable on the marketplace.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="All vehicles" value={counts.total} />
        <Metric label="Pending review" value={counts.pending} />
        <Metric label="Approved" value={counts.approved} />
        <Metric label="Changes requested" value={counts.rejected} />
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div>
            <CardTitle className="text-lg">Review queue</CardTitle>
            <CardDescription>Rejected vehicles can be approved later after the owner updates their stored listing details.</CardDescription>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid h-auto grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="PENDING">Pending</TabsTrigger>
                <TabsTrigger value="APPROVED">Approved</TabsTrigger>
                <TabsTrigger value="REJECTED">Changes</TabsTrigger>
                <TabsTrigger value="ALL">All</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search fleet..." className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Daily rate</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingQuery.isLoading || allQuery.isLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}><TableCell colSpan={6}><Skeleton className="h-12 w-full" /></TableCell></TableRow>
                  ))
                ) : visible.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No vehicles match this view.</TableCell></TableRow>
                ) : (
                  visible.map((car) => (
                    <TableRow key={car.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {car.mainImageUrl ? <Image src={car.mainImageUrl} alt={car.name} fill className="object-cover" /> : null}
                          </div>
                          <div>
                            <div className="font-medium">{car.name}</div>
                            <div className="mt-1 font-mono text-xs text-muted-foreground">{car.licensePlate}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{[car.owner?.firstName, car.owner?.lastName].filter(Boolean).join(" ") || "Owner"}</div>
                        <div className="text-xs text-muted-foreground">{car.owner?.email || "—"}</div>
                      </TableCell>
                      <TableCell className="font-medium">{currency.format(Number(car.pricePerDay || 0))}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{car.createdAt ? dateFormatter.format(new Date(car.createdAt)) : "—"}</TableCell>
                      <TableCell><StatusBadge status={car.verificationStatus} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelected(car)}><Eye />Review</Button>
                          {car.verificationStatus !== "APPROVED" ? (
                            <Button size="sm" onClick={() => approveCar(car)} disabled={approve.isPending}><CheckCircle2 />Approve</Button>
                          ) : null}
                          {car.verificationStatus === "PENDING" ? (
                            <Button size="sm" variant="outline" onClick={() => { setRejecting(car); setReason(""); }}><XCircle />Request changes</Button>
                          ) : null}
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

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
            <SheetDescription>{selected?.licensePlate} · marketplace review</SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="space-y-6 px-4 pb-8">
              <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted">
                {selected.mainImageUrl ? <Image src={selected.mainImageUrl} alt={selected.name} fill className="object-cover" /> : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Brand / model" value={`${selected.brand ?? ""} ${selected.model ?? ""}`.trim()} />
                <Info label="Year" value={String(selected.year ?? "—")} />
                <Info label="Seats" value={String(selected.seatCount ?? "—")} />
                <Info label="Daily rate" value={currency.format(Number(selected.pricePerDay || 0))} />
              </div>
              {selected.description ? (
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Review / listing note</div>
                  <p className="mt-2 text-sm leading-6">{String(selected.description).replace(/^Lý do từ chối:\s*/i, "")}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {selected.verificationStatus !== "APPROVED" ? <Button onClick={() => approveCar(selected)}><CheckCircle2 />Approve vehicle</Button> : null}
                {selected.verificationStatus === "PENDING" ? (
                  <Button variant="outline" onClick={() => { setRejecting(selected); setReason(""); }}><XCircle />Request changes</Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request vehicle changes</DialogTitle>
            <DialogDescription>Give the owner a specific review note before this vehicle can be approved.</DialogDescription>
          </DialogHeader>
          <Textarea
            className="min-h-28"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Main image is unclear, registration details need correction..."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={rejectCar} disabled={reason.trim().length < 5 || reject.isPending}>
              {reject.isPending ? <Loader2 className="animate-spin" /> : <XCircle />}
              Return for changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardDescription>{label}</CardDescription>
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (status === "APPROVED") return <Badge variant="outline"><CheckCircle2 />Approved</Badge>;
  if (status === "REJECTED") return <Badge variant="destructive"><XCircle />Changes requested</Badge>;
  return <Badge variant="secondary"><Clock3 />Pending</Badge>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-medium">{value}</div>
    </div>
  );
}
