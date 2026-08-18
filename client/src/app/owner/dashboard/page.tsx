"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Car, CircleDollarSign, Clock3, History, Key, RefreshCw, Wallet } from "lucide-react";
import { useMyCars, useOwnerBookings, useOwnerDashboard, useOwnerTrips } from "@/features/owner/owner.queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

type OwnerCar = { id: string; status?: string; verificationStatus?: string };
type OwnerTrip = { id: string; status?: string };
type PageResult<T> = { data?: T[]; items?: T[]; total?: number };

const quickActions = [
  { title: "Manage fleet", description: "Add, edit, and submit vehicles for approval.", href: "/owner/cars", icon: Car },
  { title: "Review bookings", description: "Approve or reject incoming rental requests.", href: "/owner/bookings", icon: History },
  { title: "Update availability", description: "Block dates and manage vehicle availability.", href: "/owner/calendar", icon: CalendarDays },
  { title: "Open wallet", description: "Review your available balance and withdrawals.", href: "/owner/wallet", icon: Wallet },
] as const;

export default function OwnerDashboardPage() {
  const dashboard = useOwnerDashboard();
  const pendingBookings = useOwnerBookings({ page: 1, limit: 1, status: "PENDING" });
  const carsQuery = useMyCars({ page: 1, limit: 50 });
  const tripsQuery = useOwnerTrips({ page: 1, limit: 50 });

  const data = dashboard.data;
  const carsResult = (carsQuery.data ?? {}) as PageResult<OwnerCar>;
  const tripsResult = (tripsQuery.data ?? {}) as PageResult<OwnerTrip>;
  const bookingResult = (pendingBookings.data ?? {}) as PageResult<unknown>;
  const cars = carsResult.data ?? carsResult.items ?? [];
  const trips = tripsResult.data ?? tripsResult.items ?? [];
  const pendingBookingCount = Number(bookingResult.total ?? 0);
  const vehiclesNeedingAttention = cars.filter((car) => car.status === "DRAFT" || car.verificationStatus === "PENDING" || car.verificationStatus === "REJECTED").length;
  const upcomingTrips = trips.filter((trip) => trip.status === "UPCOMING").length;
  const isLoading = dashboard.isLoading || pendingBookings.isLoading || carsQuery.isLoading || tripsQuery.isLoading;
  const isFetching = dashboard.isFetching || pendingBookings.isFetching || carsQuery.isFetching || tripsQuery.isFetching;
  const isError = dashboard.isError || pendingBookings.isError || carsQuery.isError || tripsQuery.isError;
  const attentionTotal = pendingBookingCount + vehiclesNeedingAttention + upcomingTrips;

  const refresh = async () => {
    await Promise.all([dashboard.refetch(), pendingBookings.refetch(), carsQuery.refetch(), tripsQuery.refetch()]);
  };

  const metrics = [
    { label: "Vehicles", value: Number(data?.totalCars ?? 0).toLocaleString("en-US"), icon: Car },
    { label: "Bookings", value: Number(data?.totalBookings ?? 0).toLocaleString("en-US"), icon: History },
    { label: "Wallet balance", value: currency.format(Number(data?.balance ?? 0)), icon: Wallet },
    { label: "Lifetime rental income", value: currency.format(Number(data?.totalIncome ?? 0)), icon: CircleDollarSign },
  ];

  const attention = [
    { title: "Booking requests", value: pendingBookingCount, description: "Requests waiting for your approval decision.", href: "/owner/bookings", icon: History },
    { title: "Fleet attention", value: vehiclesNeedingAttention, description: "Draft, pending-review or rejected vehicles in the visible fleet.", href: "/owner/cars", icon: Car },
    { title: "Upcoming trips", value: upcomingTrips, description: "Visible trips that still need handover preparation.", href: "/owner/trips", icon: Key },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Owner workspace</p>{!isLoading ? <Badge variant="secondary">{attentionTotal} operational items</Badge> : null}</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Fleet overview</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">See what needs attention first, then review the live metrics for your fleet, bookings and wallet.</p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={isFetching}><RefreshCw className={isFetching ? "animate-spin" : ""} />Refresh workspace</Button>
      </div>

      {isError ? (
        <Card className="border-destructive/30"><CardHeader><CardTitle>Workspace data is incomplete</CardTitle><CardDescription>One or more owner APIs could not be reached. No fleet or financial state was changed.</CardDescription></CardHeader><CardContent><Button onClick={() => void refresh()}>Try again</Button></CardContent></Card>
      ) : null}

      <section className="space-y-4">
        <div><h2 className="text-xl font-semibold tracking-tight">Needs attention</h2><p className="mt-1 text-sm text-muted-foreground">Resolve operational work before it blocks a booking or trip.</p></div>
        <div className="grid gap-4 md:grid-cols-3">
          {attention.map((item) => (
            <Link key={item.href} href={item.href} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="h-full transition-colors group-hover:border-foreground/20 group-hover:bg-muted/30">
                <CardHeader className="gap-3"><div className="flex items-center justify-between"><div className="rounded-lg bg-muted p-2 text-muted-foreground"><item.icon className="h-4 w-4" /></div><ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></div><CardDescription>{item.title}</CardDescription><CardTitle className="text-3xl">{isLoading ? <Skeleton className="h-9 w-12" /> : item.value}</CardTitle></CardHeader>
                <CardContent className="text-xs leading-5 text-muted-foreground">{item.description}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-muted-foreground" /><div><h2 className="text-xl font-semibold tracking-tight">Business snapshot</h2><p className="mt-1 text-sm text-muted-foreground">Current operating metrics from Elite Drive.</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => <Card key={metric.label} className="gap-4"><CardHeader className="flex-row items-center justify-between space-y-0"><CardDescription className="font-medium">{metric.label}</CardDescription><div className="rounded-lg bg-muted p-2 text-muted-foreground"><metric.icon className="h-4 w-4" /></div></CardHeader><CardContent>{dashboard.isLoading ? <Skeleton className="h-8 w-28" /> : <div className="text-2xl font-bold tracking-tight">{metric.value}</div>}</CardContent></Card>)}
        </div>
      </section>

      <section className="space-y-4">
        <div><h2 className="text-xl font-semibold tracking-tight">Run your fleet</h2><p className="mt-1 text-sm text-muted-foreground">Jump directly into the workflows that keep rentals moving.</p></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => <Link key={action.href} href={action.href} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="h-full gap-4 transition-colors group-hover:border-foreground/20 group-hover:bg-muted/30"><CardHeader><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><action.icon className="h-5 w-5" /></div><CardTitle className="flex items-center justify-between gap-3 text-base">{action.title}<ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></CardTitle><CardDescription className="leading-6">{action.description}</CardDescription></CardHeader></Card></Link>)}
        </div>
      </section>
    </div>
  );
}
