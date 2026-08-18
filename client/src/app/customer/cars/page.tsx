"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  CheckCircle2,
  Filter,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://elitedrive-demoversion.onrender.com";

type SearchState = {
  city: string;
  startDate: string;
  endDate: string;
  transmission: string;
  minPrice: string;
  maxPrice: string;
};

const formatDate = (date: Date) => date.toISOString().split("T")[0];
const money = (value?: number) =>
  typeof value === "number" ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value) : "—";

function defaultSearch(): SearchState {
  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + 1);
  return {
    city: "",
    startDate: formatDate(start),
    endDate: formatDate(end),
    transmission: "",
    minPrice: "",
    maxPrice: "",
  };
}

export default function FleetPage() {
  const [query, setQuery] = useState<SearchState>(defaultSearch);
  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCar, setSelectedCar] = useState<any | null>(null);
  const [completedBooking, setCompletedBooking] = useState<any | null>(null);

  const tripDays = useMemo(() => {
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    const value = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }, [query.endDate, query.startDate]);

  const fetchCars = useCallback(async (nextQuery: SearchState, initial = false) => {
    if (new Date(nextQuery.endDate) < new Date(nextQuery.startDate)) {
      setError("Return date must be on or after the pick-up date.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (nextQuery.city.trim()) params.set("city", nextQuery.city.trim());
      if (nextQuery.startDate) params.set("startDate", nextQuery.startDate);
      if (nextQuery.endDate) params.set("endDate", nextQuery.endDate);
      if (nextQuery.transmission) params.set("transmission", nextQuery.transmission);
      if (nextQuery.minPrice) params.set("minPrice", nextQuery.minPrice);
      if (nextQuery.maxPrice) params.set("maxPrice", nextQuery.maxPrice);
      params.set("limit", "24");

      const response = await fetch(`${API_BASE}/api/cars?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "Unable to load vehicles.");

      const data = Array.isArray(payload?.data) ? payload.data : [];
      setCars(data);
      if (!data.length) setError("No vehicles match these dates and filters. Try a broader search.");

      if (!initial && typeof window !== "undefined") {
        window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
      }
    } catch (requestError: any) {
      setCars([]);
      setError(requestError?.message || "The fleet service is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const base = defaultSearch();
    const initialQuery: SearchState = {
      city: params.get("city") || base.city,
      startDate: params.get("startDate") || base.startDate,
      endDate: params.get("endDate") || base.endDate,
      transmission: params.get("transmission") || base.transmission,
      minPrice: params.get("minPrice") || base.minPrice,
      maxPrice: params.get("maxPrice") || base.maxPrice,
    };
    setQuery(initialQuery);
    fetchCars(initialQuery, true);
  }, [fetchCars]);

  const resetFilters = () => {
    const next = defaultSearch();
    setQuery(next);
    fetchCars(next);
  };

  const openBooking = (car: any) => {
    const token = Cookies.get("token");
    if (!token) {
      toast.error("Sign in to confirm a booking.");
      window.location.href = "/login";
      return;
    }
    setSelectedCar(car);
  };

  const confirmBooking = async () => {
    if (!selectedCar) return;
    setBooking(true);

    try {
      const response = await fetch(`${API_BASE}/api/customer/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Cookies.get("token") || ""}`,
        },
        body: JSON.stringify({
          carId: selectedCar.id,
          startDate: query.startDate,
          endDate: query.endDate,
          pickupLocation: selectedCar.location?.name || query.city || "Ho Chi Minh City",
          dropoffLocation: selectedCar.location?.name || query.city || "Ho Chi Minh City",
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "Unable to create this booking.");

      setCompletedBooking(payload?.data || null);
      setSelectedCar(null);
      toast.success("Booking confirmed.");
    } catch (requestError: any) {
      toast.error(requestError?.message || "Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  if (completedBooking) {
    return (
      <main className="min-h-screen bg-[#090909] px-5 py-20 text-white">
        <div className="mx-auto max-w-xl">
          <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-[#111] text-white">
            <div className="bg-white p-10 text-center text-black">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black text-white">
                <CheckCircle2 className="h-8 w-8" />
              </span>
              <h1 className="mt-5 text-3xl font-black tracking-tight">Booking confirmed</h1>
              <p className="mt-2 text-sm text-black/55">Your trip is now in the Elite Drive booking workflow.</p>
            </div>
            <CardContent className="space-y-5 p-8">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-5">
                <span className="text-sm text-white/45">Booking reference</span>
                <span className="font-mono font-bold">#{String(completedBooking.id || "").slice(-8).toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-5">
                <span className="text-sm text-white/45">Total</span>
                <span className="text-xl font-black">{money(completedBooking.totalPrice)} ₫</span>
              </div>
              <Button asChild className="h-12 w-full rounded-xl bg-white text-black hover:bg-white/90">
                <Link href="/customer/bookings">Manage booking</Link>
              </Button>
              <Button variant="ghost" className="w-full text-white hover:bg-white/10 hover:text-white" onClick={() => setCompletedBooking(null)}>
                Continue browsing
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black"><Car className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-black tracking-[0.2em]">ELITE DRIVE</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Live fleet</p>
            </div>
          </Link>
          <Button asChild variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
            <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Home</Link>
          </Button>
        </div>
      </header>

      <section className="border-b border-white/10 bg-white/[.025]">
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <Badge className="rounded-full border border-white/15 bg-white/5 text-white">Real-time search</Badge>
              <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">Find your next drive.</h1>
              <p className="mt-3 max-w-2xl text-white/50">Search the live fleet and create a real booking from the same workflow.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/45">
              <ShieldCheck className="h-4 w-4" /> Authenticated booking confirmation
            </div>
          </div>

          <div className="mt-9 rounded-[1.75rem] border border-white/10 bg-black/35 p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold"><SlidersHorizontal className="h-4 w-4" /> Search filters</div>
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters} className="text-white/50 hover:bg-white/10 hover:text-white">Reset</Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <label className="xl:col-span-2">
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-white/40">City</span>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <Input value={query.city} onChange={(event) => setQuery((value) => ({ ...value, city: event.target.value }))} placeholder="Ho Chi Minh City" className="h-11 border-white/10 bg-white/5 pl-9 text-white" />
                </div>
              </label>
              <label>
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-white/40">Pick-up</span>
                <Input type="date" min={formatDate(new Date())} value={query.startDate} onChange={(event) => setQuery((value) => ({ ...value, startDate: event.target.value }))} className="h-11 border-white/10 bg-white/5 text-white [color-scheme:dark]" />
              </label>
              <label>
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-white/40">Return</span>
                <Input type="date" min={query.startDate} value={query.endDate} onChange={(event) => setQuery((value) => ({ ...value, endDate: event.target.value }))} className="h-11 border-white/10 bg-white/5 text-white [color-scheme:dark]" />
              </label>
              <label>
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-white/40">Transmission</span>
                <select value={query.transmission} onChange={(event) => setQuery((value) => ({ ...value, transmission: event.target.value }))} className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm outline-none focus:ring-2 focus:ring-white/30">
                  <option value="" className="text-black">Any</option>
                  <option value="Automatic" className="text-black">Automatic</option>
                  <option value="Manual" className="text-black">Manual</option>
                </select>
              </label>
              <div className="flex items-end">
                <Button onClick={() => fetchCars(query)} disabled={loading} className="h-11 w-full bg-white font-bold text-black hover:bg-white/90">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />} Search
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:max-w-xl">
              <label>
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-white/40">Min price / day</span>
                <Input inputMode="numeric" value={query.minPrice} onChange={(event) => setQuery((value) => ({ ...value, minPrice: event.target.value.replace(/\D/g, "") }))} placeholder="0" className="h-11 border-white/10 bg-white/5 text-white" />
              </label>
              <label>
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-white/40">Max price / day</span>
                <Input inputMode="numeric" value={query.maxPrice} onChange={(event) => setQuery((value) => ({ ...value, maxPrice: event.target.value.replace(/\D/g, "") }))} placeholder="No limit" className="h-11 border-white/10 bg-white/5 text-white" />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/40">{loading ? "Checking availability…" : `${cars.length} vehicle${cars.length === 1 ? "" : "s"} found`}</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4" /> {tripDays} day{tripDays === 1 ? "" : "s"} selected</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/40"><Filter className="h-4 w-4" /> API-backed filters</div>
        </div>

        {error && !loading ? (
          <div className="mb-8 rounded-2xl border border-white/10 bg-white/[.04] p-5 text-sm text-white/65">{error}</div>
        ) : null}

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-[430px] animate-pulse rounded-[1.75rem] border border-white/10 bg-white/5" />)}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {cars.map((car) => (
              <Card key={car.id} className="group overflow-hidden rounded-[1.75rem] border-white/10 bg-[#111] text-white shadow-none transition hover:border-white/20">
                <div className="relative h-60 overflow-hidden bg-white/5">
                  <Image src={car.mainImageUrl || "/images/car3.png"} alt={car.name || "Vehicle"} fill unoptimized className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                  <div className="absolute left-4 top-4 flex gap-2">
                    <Badge className="border border-white/15 bg-black/65 text-white backdrop-blur">{car.transmission || "Automatic"}</Badge>
                    {car.seatCount ? <Badge className="border border-white/15 bg-black/65 text-white backdrop-blur"><Users className="mr-1 h-3 w-3" /> {car.seatCount}</Badge> : null}
                  </div>
                </div>

                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/35">{car.location?.name || query.city || "Elite Drive"}</p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight">{car.name || "Premium vehicle"}</h2>
                    </div>
                  </div>

                  <div className="mt-5 flex items-end justify-between border-t border-white/10 pt-5">
                    <div>
                      <p className="text-xs text-white/40">Daily rate</p>
                      <p className="mt-1 text-xl font-black">{money(car.pricePerDay)} ₫</p>
                      <p className="mt-1 text-xs text-white/35">Est. {money((car.pricePerDay || 0) * tripDays)} ₫ for {tripDays} day{tripDays === 1 ? "" : "s"}</p>
                    </div>
                    <Button onClick={() => openBooking(car)} className="rounded-full bg-white px-5 font-bold text-black hover:bg-white/90">Book</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={Boolean(selectedCar)} onOpenChange={(open) => !open && setSelectedCar(null)}>
        <DialogContent className="border-white/10 bg-[#111] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Confirm your booking</DialogTitle>
            <DialogDescription className="text-white/45">This action creates a booking through the authenticated customer API.</DialogDescription>
          </DialogHeader>

          {selectedCar ? (
            <div className="space-y-4 py-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-lg font-bold">{selectedCar.name}</p>
                <p className="mt-1 text-sm text-white/45">{selectedCar.location?.name || query.city || "Ho Chi Minh City"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 p-4">
                  <p className="text-xs uppercase tracking-wider text-white/35">Pick-up</p>
                  <p className="mt-2 text-sm font-bold">{query.startDate}</p>
                </div>
                <div className="rounded-2xl border border-white/10 p-4">
                  <p className="text-xs uppercase tracking-wider text-white/35">Return</p>
                  <p className="mt-2 text-sm font-bold">{query.endDate}</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white p-5 text-black">
                <span className="text-sm font-semibold">Estimated total</span>
                <span className="text-xl font-black">{money((selectedCar.pricePerDay || 0) * tripDays)} ₫</span>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedCar(null)} className="text-white hover:bg-white/10 hover:text-white">Cancel</Button>
            <Button onClick={confirmBooking} disabled={booking} className="bg-white font-bold text-black hover:bg-white/90">
              {booking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
