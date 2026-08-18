"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Car, CircleDollarSign, History, RefreshCw, Wallet } from "lucide-react";
import { useOwnerDashboard } from "@/features/owner/owner.queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const quickActions = [
  { title: "Manage fleet", description: "Add, edit, and submit vehicles for approval.", href: "/owner/cars", icon: Car },
  { title: "Review bookings", description: "Approve or reject incoming rental requests.", href: "/owner/bookings", icon: History },
  { title: "Update availability", description: "Block dates and manage vehicle availability.", href: "/owner/calendar", icon: CalendarDays },
  { title: "Open wallet", description: "Review your available balance and withdrawals.", href: "/owner/wallet", icon: Wallet },
] as const;

export default function OwnerDashboardPage() {
  const { data, isLoading, isError, refetch, isFetching } = useOwnerDashboard();

  const metrics = [
    { label: "Vehicles", value: Number(data?.totalCars ?? 0).toLocaleString("en-US"), icon: Car },
    { label: "Bookings", value: Number(data?.totalBookings ?? 0).toLocaleString("en-US"), icon: History },
    { label: "Wallet balance", value: currency.format(Number(data?.balance ?? 0)), icon: Wallet },
    { label: "Lifetime rental income", value: currency.format(Number(data?.totalIncome ?? 0)), icon: CircleDollarSign },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Owner workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Fleet overview</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Live operating metrics from your Elite Drive fleet, bookings, and wallet.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? "animate-spin" : ""} />
          Refresh metrics
        </Button>
      </div>

      {isError ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Dashboard data is unavailable</CardTitle>
            <CardDescription>The owner API could not be reached. Your fleet data has not been changed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => refetch()}>Try again</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.label} className="gap-4">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardDescription className="font-medium">{metric.label}</CardDescription>
                <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                  <metric.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-28" /> : <div className="text-2xl font-bold tracking-tight">{metric.value}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Run your fleet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Jump directly into the workflows that keep rentals moving.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="h-full gap-4 transition-colors group-hover:border-foreground/20 group-hover:bg-muted/30">
                <CardHeader>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <action.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="flex items-center justify-between gap-3 text-base">
                    {action.title}
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </CardTitle>
                  <CardDescription className="leading-6">{action.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
