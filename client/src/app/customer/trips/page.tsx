"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, FileSignature, Gauge, KeyRound, Loader2, MapPin, Route, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useContract, useSignContract, useTrips, useTripStatus } from "@/features/customer/customer.queries";
import { notify, notifyError } from "@/lib/notifications";

type TripStatus = "UPCOMING" | "ONGOING" | "COMPLETED";

type TripRecord = {
  id: string;
  status: TripStatus;
  startOdometer?: number | null;
  endOdometer?: number | null;
  startFuelLevel?: number | null;
  endFuelLevel?: number | null;
  pickupNotes?: string | null;
  dropoffNotes?: string | null;
  booking: {
    id: string;
    startDate: string;
    endDate: string;
    pickupLocation?: string | null;
    dropoffLocation?: string | null;
    car?: { name?: string | null; brand?: string | null; licensePlate?: string | null } | null;
  };
};

type ContractRecord = {
  id: string;
  bookingId: string;
  content: string;
  status: string;
  customerSignedAt?: string | null;
};

const dates = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function statusVariant(status: TripStatus): "default" | "secondary" | "outline" {
  if (status === "ONGOING") return "default";
  if (status === "COMPLETED") return "outline";
  return "secondary";
}

export default function CustomerTripsPage() {
  const query = useTrips({ page: 1, limit: 50 });
  const trips = useMemo<TripRecord[]>(() => {
    const response = query.data as { data?: TripRecord[]; items?: TripRecord[] } | TripRecord[] | undefined;
    if (Array.isArray(response)) return response;
    return response?.data ?? response?.items ?? [];
  }, [query.data]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Trips</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Trip status & contracts</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Resume confirmed rentals here, review vehicle handover status, and complete the customer contract acknowledgment when it becomes available.
          </p>
        </div>
        <Button asChild variant="outline"><Link href="/customer/bookings">Back to bookings</Link></Button>
      </div>

      {query.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-72 w-full rounded-xl" />)}
        </div>
      ) : query.isError ? (
        <Card className="border-destructive/30">
          <CardHeader><CardTitle className="text-lg">Trip status could not be loaded</CardTitle><CardDescription>No trip state was changed. Retry when the API is available.</CardDescription></CardHeader>
          <CardContent><Button onClick={() => query.refetch()}>Try again</Button></CardContent>
        </Card>
      ) : trips.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Route className="h-8 w-8 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">No confirmed trips yet</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">A trip appears after an approved booking has a completed payment record.</p>
            <Button asChild className="mt-5"><Link href="/customer/bookings">Review bookings</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => <TripCard key={trip.id} trip={trip} />)}
        </div>
      )}
    </div>
  );
}

function TripCard({ trip }: { trip: TripRecord }) {
  const statusQuery = useTripStatus(trip.id);
  const contractQuery = useContract(trip.booking.id);
  const signContract = useSignContract();
  const [signatureName, setSignatureName] = useState("");

  const liveStatus = (statusQuery.data?.status ?? trip.status) as TripStatus;
  const contract = contractQuery.data as ContractRecord | undefined;
  const isSigned = Boolean(contract?.customerSignedAt) || contract?.status === "SIGNED";

  const submitSignature = async () => {
    const typedName = signatureName.trim();
    if (typedName.length < 2) {
      notify.warning("Enter your full name", {
        id: `contract-sign-${trip.booking.id}`,
        description: "Type the name you intend to use for this demo electronic acknowledgment.",
      });
      return;
    }
    if (!contract) return;

    try {
      await signContract.mutateAsync({
        bookingId: trip.booking.id,
        dto: { signatureData: `TYPED_ACKNOWLEDGMENT:${typedName}` },
      });
      notify.success("Contract acknowledged", {
        id: `contract-sign-${trip.booking.id}`,
        description: "Your typed acknowledgment has been recorded for this portfolio/demo contract flow.",
      });
      setSignatureName("");
      await contractQuery.refetch();
    } catch (error: unknown) {
      notifyError(
        "Contract could not be signed",
        error,
        "No acknowledgment was recorded. Check the current booking state and try again.",
        { id: `contract-sign-${trip.booking.id}` },
      );
    }
  };

  return (
    <Card className="overflow-hidden p-0">
      <CardContent className="p-0">
        <div className="grid lg:grid-cols-[1fr_340px]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(liveStatus)}>{liveStatus}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">#{trip.booking.id.slice(-8).toUpperCase()}</span>
                </div>
                <h2 className="mt-3 text-xl font-semibold">{trip.booking.car?.name || "Elite Drive vehicle"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{trip.booking.car?.brand || "Rental vehicle"}{trip.booking.car?.licensePlate ? ` · ${trip.booking.car.licensePlate}` : ""}</p>
              </div>
              <KeyRound className="h-6 w-6 text-muted-foreground" />
            </div>

            <div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-2">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" />{dates.format(new Date(trip.booking.startDate))} — {dates.format(new Date(trip.booking.endDate))}</div>
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{trip.booking.pickupLocation || "Pickup location confirmed with owner"}</div>
              </div>
              <div className="space-y-2 rounded-xl bg-muted/40 p-4 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><Gauge className="h-4 w-4" />Odometer</span><span>{trip.startOdometer ?? "—"}{trip.endOdometer != null ? ` → ${trip.endOdometer}` : ""}{trip.startOdometer != null ? " km" : ""}</span></div>
                <div className="flex items-center justify-between gap-3"><span>Fuel</span><span>{trip.startFuelLevel ?? "—"}{trip.endFuelLevel != null ? ` → ${trip.endFuelLevel}` : ""}{trip.startFuelLevel != null ? "%" : ""}</span></div>
              </div>
            </div>

            <div className="mt-5 rounded-xl border bg-background p-4 text-sm">
              <div className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" />Current handover state</div>
              <p className="mt-2 text-muted-foreground">
                {liveStatus === "UPCOMING" && "The owner has not recorded vehicle pickup yet."}
                {liveStatus === "ONGOING" && "Vehicle pickup is recorded. The rental is currently in progress."}
                {liveStatus === "COMPLETED" && "Vehicle return has been recorded and the trip handover is complete."}
              </p>
            </div>
          </div>

          <div className="border-t bg-muted/25 p-5 lg:border-l lg:border-t-0 sm:p-6">
            <div className="flex items-center gap-2"><FileSignature className="h-5 w-5" /><h3 className="font-semibold">Rental contract</h3></div>
            {contractQuery.isLoading ? (
              <div className="mt-4 space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : contractQuery.isError || !contract ? (
              <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Contract data is not available yet. This can be normal before the backend creates the contract for the confirmed booking.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl border bg-background p-4 text-xs leading-5 text-muted-foreground">
                  {contract.content || "Contract content is currently empty."}
                </div>
                {isSigned ? (
                  <div className="flex items-center gap-2 rounded-xl border bg-background p-3 text-sm font-medium"><CheckCircle2 className="h-4 w-4" />Customer acknowledgment recorded</div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs leading-5 text-muted-foreground">Portfolio/demo acknowledgment only. Type your full name to exercise the contract state transition; this UI does not claim to provide production-grade e-signature compliance.</p>
                    <Input value={signatureName} onChange={(event) => setSignatureName(event.target.value)} placeholder="Type full name" maxLength={120} />
                    <Button className="w-full" onClick={() => void submitSignature()} disabled={signContract.isPending}>
                      {signContract.isPending ? <Loader2 className="animate-spin" /> : <FileSignature />}Acknowledge contract
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
