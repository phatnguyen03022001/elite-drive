"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Car, CheckCircle2, Info, Loader2, Phone, User, XCircle } from "lucide-react";
import { toast } from "sonner";
import { OwnerService } from "@/features/owner/owner.service";
import { useOwnerBookings } from "@/features/owner/owner.queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const dates = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const STATUS_LABELS: Record<string, string> = {
  PENDING: "New request",
  APPROVED: "Owner approved",
  REJECTED: "Declined",
  CONFIRMED: "Paid & confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function OwnerBookingsPage() {
  const [status, setStatus] = useState("PENDING");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const query = useOwnerBookings({ page: 1, limit: 20, status });
  const bookings = useMemo(() => (Array.isArray(query.data) ? query.data : query.data?.data ?? []), [query.data]);

  const handleAction = async (bookingId: string, action: "approve" | "reject") => {
    const isApprove = action === "approve";
    if (!window.confirm(isApprove ? "Approve this rental request?" : "Decline this rental request?")) return;

    let reason = "";
    if (!isApprove) {
      const response = window.prompt("Reason for declining this request:", "Vehicle is unavailable for the requested dates");
      if (response === null) return;
      reason = response.trim() || "Vehicle is unavailable for the requested dates";
    }

    setProcessingId(bookingId);
    try {
      if (isApprove) await OwnerService.approveBooking(bookingId);
      else await OwnerService.rejectBooking(bookingId, { reason });
      toast.success(isApprove ? "Booking approved" : "Booking declined");
      await query.refetch();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Could not update this booking");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 py-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Operations</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Booking requests</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Review incoming requests and follow approved rentals through payment and completion.
        </p>
      </div>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList className="grid h-auto w-full max-w-3xl grid-cols-2 gap-1 sm:grid-cols-5">
          <TabsTrigger value="PENDING">New</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved</TabsTrigger>
          <TabsTrigger value="CONFIRMED">Confirmed</TabsTrigger>
          <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
          <TabsTrigger value="REJECTED">Declined</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-52 w-full rounded-xl" />)}
        </div>
      ) : query.isError ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Could not load booking requests</CardTitle>
            <CardDescription>The owner booking API returned an error. No booking data was changed.</CardDescription>
          </CardHeader>
          <CardContent><Button onClick={() => query.refetch()}>Try again</Button></CardContent>
        </Card>
      ) : bookings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Info className="h-8 w-8 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">No bookings in this state</h2>
            <p className="mt-2 text-sm text-muted-foreground">Requests will appear here as customers move through the rental lifecycle.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bookings.map((booking: any) => {
            const paid = booking.payments?.some((payment: any) => payment.status === "COMPLETED");
            return (
              <Card key={booking.id} className="overflow-hidden p-0">
                <div className="grid lg:grid-cols-[1fr_290px]">
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-muted p-2.5"><Car className="h-5 w-5" /></div>
                        <div>
                          <h2 className="font-semibold">{booking.car?.name || "Vehicle"}</h2>
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{booking.car?.licensePlate || booking.id.slice(-8).toUpperCase()}</p>
                        </div>
                      </div>
                      <Badge variant={booking.status === "REJECTED" ? "destructive" : booking.status === "PENDING" ? "secondary" : "outline"}>
                        {STATUS_LABELS[booking.status] || booking.status}
                      </Badge>
                    </div>

                    <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><span>{booking.customer?.firstName} {booking.customer?.lastName}</span></div>
                      <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{booking.customer?.phone || "Phone not provided"}</span></div>
                      <div className="flex items-center gap-2 sm:col-span-2"><CalendarDays className="h-4 w-4 text-muted-foreground" /><span>{dates.format(new Date(booking.startDate))} — {dates.format(new Date(booking.endDate))}</span></div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-5 border-t bg-muted/30 p-5 lg:border-l lg:border-t-0 sm:p-6">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Booking value</div>
                      <div className="mt-2 text-2xl font-bold">{currency.format(Number(booking.totalPrice || 0))}</div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={`h-2 w-2 rounded-full ${paid ? "bg-foreground" : "bg-muted-foreground/40"}`} />
                        {paid ? "Payment held in escrow" : "Payment not completed"}
                      </div>
                    </div>

                    {booking.status === "PENDING" ? (
                      <div className="space-y-2">
                        <Button className="w-full" onClick={() => handleAction(booking.id, "approve")} disabled={processingId !== null}>
                          {processingId === booking.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                          Approve request
                        </Button>
                        <Button variant="outline" className="w-full hover:border-destructive/30 hover:text-destructive" onClick={() => handleAction(booking.id, "reject")} disabled={processingId !== null}>
                          <XCircle />
                          Decline request
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
