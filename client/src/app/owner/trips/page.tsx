"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Fuel, Gauge, MapPin, Phone, User } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface Trip {
  id: string;
  status: "UPCOMING" | "ONGOING" | "COMPLETED" | "CANCELLED";
  startOdometer?: number;
  endOdometer?: number;
  startFuelLevel?: number;
  endFuelLevel?: number;
  pickupNotes?: string;
  dropoffNotes?: string;
  car: { name: string; licensePlate: string };
  booking: {
    startDate: string;
    endDate: string;
    pickupLocation?: string;
    totalPrice: number;
    customer: { firstName: string; lastName: string; phone?: string };
  };
}

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function OwnerTripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<{ type: "checkin" | "checkout"; trip: Trip } | null>(null);
  const [form, setForm] = useState({ odometer: 0, fuel: 100, notes: "" });

  const fetchTrips = async () => {
    try {
      const response = await api.get("/api/owner/trips");
      setTrips(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      toast.error(error?.message || "Could not load trip handovers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTrips();
  }, []);

  const openHandover = (type: "checkin" | "checkout", trip: Trip) => {
    setModal({ type, trip });
    setForm({
      odometer: type === "checkout" ? Number(trip.startOdometer || 0) : 0,
      fuel: type === "checkout" ? Number(trip.startFuelLevel || 100) : 100,
      notes: "",
    });
  };

  const submitHandover = async () => {
    if (!modal) return;
    if (form.odometer < 0 || form.fuel < 0 || form.fuel > 100) {
      toast.error("Enter a valid odometer and fuel level between 0 and 100%");
      return;
    }

    setSubmitting(true);
    try {
      const payload = modal.type === "checkin"
        ? { startOdometer: form.odometer, startFuelLevel: form.fuel, pickupNotes: form.notes.trim() }
        : { endOdometer: form.odometer, endFuelLevel: form.fuel, dropoffNotes: form.notes.trim() };
      await api.post(`/api/owner/trips/${modal.trip.id}/${modal.type}`, payload);
      toast.success(modal.type === "checkin" ? "Vehicle handover recorded" : "Vehicle return recorded");
      setModal(null);
      await fetchTrips();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Could not record the handover");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 py-4">
        <Skeleton className="h-10 w-56" />
        {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-56 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 py-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Operations</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Trip handover</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Record vehicle condition at pickup and return, including odometer, fuel level, and handover notes.
        </p>
      </div>

      {trips.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <h2 className="font-semibold">No trips to hand over</h2>
            <p className="mt-2 text-sm text-muted-foreground">Confirmed bookings generate upcoming trips automatically.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {trips.map((trip) => (
            <Card key={trip.id} className="overflow-hidden p-0">
              <CardContent className="p-0">
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant={trip.status === "CANCELLED" ? "destructive" : trip.status === "ONGOING" ? "default" : "outline"}>{trip.status}</Badge>
                        <h2 className="text-lg font-semibold">{trip.car?.name}</h2>
                      </div>
                      <p className="mt-2 w-fit rounded-md border px-2 py-1 font-mono text-xs">{trip.car?.licensePlate}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{currency.format(Number(trip.booking?.totalPrice || 0))}</div>
                      <div className="text-xs text-muted-foreground">Booking value</div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-5 border-t pt-5 md:grid-cols-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 font-medium"><User className="h-4 w-4" />{trip.booking?.customer?.firstName} {trip.booking?.customer?.lastName}</div>
                      <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />{trip.booking?.customer?.phone || "Phone not provided"}</div>
                      <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" />{trip.booking?.pickupLocation || "Pickup location not specified"}</div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" />{dateTime.format(new Date(trip.booking?.startDate))}</div>
                      <div className="pl-6 text-xs text-muted-foreground">to</div>
                      <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" />{dateTime.format(new Date(trip.booking?.endDate))}</div>
                    </div>
                    <div className="space-y-3 rounded-xl bg-muted/40 p-4 text-sm">
                      <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><Gauge className="h-4 w-4" />Odometer</span><span>{trip.status === "UPCOMING" ? "—" : `${trip.startOdometer ?? 0} km${trip.status === "COMPLETED" ? ` → ${trip.endOdometer ?? 0} km` : ""}`}</span></div>
                      <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><Fuel className="h-4 w-4" />Fuel</span><span>{trip.status === "UPCOMING" ? "—" : `${trip.startFuelLevel ?? 0}%${trip.status === "COMPLETED" ? ` → ${trip.endFuelLevel ?? 0}%` : ""}`}</span></div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/30 px-5 py-4 sm:px-6">
                  <div className="text-xs text-muted-foreground">
                    {trip.pickupNotes ? <div>Pickup: {trip.pickupNotes}</div> : null}
                    {trip.dropoffNotes ? <div>Return: {trip.dropoffNotes}</div> : null}
                    {!trip.pickupNotes && !trip.dropoffNotes ? "No handover notes recorded yet." : null}
                  </div>
                  {trip.status === "UPCOMING" ? <Button size="sm" onClick={() => openHandover("checkin", trip)}>Record pickup</Button> : null}
                  {trip.status === "ONGOING" ? <Button size="sm" onClick={() => openHandover("checkout", trip)}>Record return</Button> : null}
                  {trip.status === "COMPLETED" ? <Badge variant="outline">Handover complete</Badge> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(modal)} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal?.type === "checkin" ? "Record vehicle pickup" : "Record vehicle return"}</DialogTitle>
            <DialogDescription>Capture the physical handover state for {modal?.trip.car.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="odometer">Odometer (km)</Label><Input id="odometer" type="number" min={0} value={form.odometer} onChange={(event) => setForm({ ...form, odometer: Number(event.target.value) })} /></div>
              <div className="space-y-2"><Label htmlFor="fuel">Fuel level (%)</Label><Input id="fuel" type="number" min={0} max={100} value={form.fuel} onChange={(event) => setForm({ ...form, fuel: Number(event.target.value) })} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="notes">Condition notes</Label><Textarea id="notes" placeholder="Exterior, interior, cleanliness, accessories, visible damage..." value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={submitHandover} disabled={submitting}>{submitting ? "Saving..." : "Save handover"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
