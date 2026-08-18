"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Car, Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface CarItem {
  id: string;
  name: string;
  licensePlate: string;
  verificationStatus: string;
}

interface Availability {
  date: string;
  isAvailable: boolean;
}

const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function OwnerCalendarPage() {
  const [cars, setCars] = useState<CarItem[]>([]);
  const [selectedCar, setSelectedCar] = useState<CarItem | null>(null);
  const [calendar, setCalendar] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const days = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() + index);
        return date;
      }),
    [],
  );

  const fetchCars = useCallback(async () => {
    try {
      const response = await api.get("/api/owner/cars");
      const approved = (Array.isArray(response.data) ? response.data : []).filter(
        (car: CarItem) => car.verificationStatus === "APPROVED",
      );
      setCars(approved);
      setSelectedCar((current) => current ?? approved[0] ?? null);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Could not load approved vehicles"));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCalendar = useCallback(
    async (carId: string) => {
      setCalendarLoading(true);
      try {
        const start = days[0];
        const end = days[days.length - 1];
        const response = await api.get(`/api/owner/cars/${carId}/calendar`, {
          params: {
            start_date: start.toISOString().slice(0, 10),
            end_date: end.toISOString().slice(0, 10),
          },
        });
        setCalendar(Array.isArray(response.data) ? response.data : []);
      } catch (error: unknown) {
        toast.error(errorMessage(error, "Could not load vehicle availability"));
      } finally {
        setCalendarLoading(false);
      }
    },
    [days],
  );

  useEffect(() => {
    void fetchCars();
  }, [fetchCars]);

  useEffect(() => {
    if (selectedCar) void fetchCalendar(selectedCar.id);
  }, [selectedCar, fetchCalendar]);

  const toggleAvailability = async (date: string, currentlyAvailable: boolean) => {
    if (!selectedCar) return;
    setActionLoading(date);
    try {
      await api.post(`/api/owner/cars/${selectedCar.id}/calendar/block`, {
        date,
        isBlocked: currentlyAvailable,
        blockedReason: currentlyAvailable ? "Owner unavailable" : null,
      });
      toast.success(currentlyAvailable ? "Date blocked" : "Date reopened");
      await fetchCalendar(selectedCar.id);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Could not update availability"));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 py-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-12">
          <Skeleton className="h-[520px] md:col-span-3" />
          <Skeleton className="h-[520px] md:col-span-9" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 py-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Fleet</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Availability calendar</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Control the next 30 days of availability for approved vehicles. Block dates when a car cannot be rented and reopen them when plans change.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <Card className="md:col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Approved vehicles</CardTitle>
            <CardDescription>Only vehicles approved by operations can be scheduled.</CardDescription>
          </CardHeader>
          <CardContent className="px-3">
            <ScrollArea className="h-[480px] pr-2">
              <div className="space-y-1">
                {cars.map((car) => (
                  <Button
                    key={car.id}
                    variant={selectedCar?.id === car.id ? "secondary" : "ghost"}
                    className="h-auto w-full justify-start gap-3 px-3 py-3"
                    onClick={() => setSelectedCar(car)}
                  >
                    <Car className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 text-left">
                      <span className="block truncate font-medium">{car.name}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{car.licensePlate}</span>
                    </span>
                  </Button>
                ))}
                {cars.length === 0 ? (
                  <div className="p-5 text-center text-sm text-muted-foreground">No approved vehicles yet.</div>
                ) : null}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="md:col-span-8 lg:col-span-9">
          {selectedCar ? (
            <>
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{selectedCar.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {selectedCar.licensePlate} · Select a date to block or reopen it.
                    </CardDescription>
                  </div>
                  <Badge variant="outline">Approved</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {calendarLoading ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                    {Array.from({ length: 18 }).map((_, index) => (
                      <Skeleton key={index} className="h-28 rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                    {days.map((date) => {
                      const dateString = date.toISOString().slice(0, 10);
                      const record = calendar.find((entry) => entry.date.startsWith(dateString));
                      const isAvailable = record ? record.isAvailable : true;
                      const isProcessing = actionLoading === dateString;
                      return (
                        <div key={dateString} className="rounded-xl border p-3 text-center">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            {weekday.format(date)}
                          </div>
                          <div className="mt-1 font-semibold">{shortDate.format(date)}</div>
                          <Button
                            size="sm"
                            variant={isAvailable ? "outline" : "secondary"}
                            className="mt-3 w-full"
                            disabled={actionLoading !== null}
                            onClick={() => toggleAvailability(dateString, isAvailable)}
                          >
                            {isProcessing ? <Loader2 className="animate-spin" /> : isAvailable ? <Unlock /> : <Lock />}
                            {isAvailable ? "Available" : "Blocked"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex min-h-96 flex-col items-center justify-center text-center">
              <CalendarDays className="h-8 w-8 text-muted-foreground" />
              <h2 className="mt-4 font-semibold">Select an approved vehicle</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Availability controls appear after a vehicle has passed review.
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
