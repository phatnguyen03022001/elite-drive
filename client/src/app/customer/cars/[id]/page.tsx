"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  CheckCircle2,
  Fuel,
  Gauge,
  Loader2,
  MapPin,
  Palette,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const DAY_MS = 86_400_000;

const dateInputValue = (date: Date) => date.toISOString().split("T")[0];
const money = (value?: number) =>
  typeof value === "number"
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
    : "—";

function initialDates() {
  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + 1);
  return { startDate: dateInputValue(start), endDate: dateInputValue(end) };
}

function normalizeDates(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    const nextEnd = new Date(start.getTime() + DAY_MS);
    return { startDate, endDate: dateInputValue(nextEnd) };
  }
  return { startDate, endDate };
}

export default function CarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const defaults = useMemo(initialDates, []);

  const [car, setCar] = useState<any | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [dates, setDates] = useState(defaults);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tripDays = useMemo(() => {
    const start = new Date(dates.startDate);
    const end = new Date(dates.endDate);
    const count = Math.ceil((end.getTime() - start.getTime()) / DAY_MS);
    return Number.isFinite(count) && count > 0 ? count : 1;
  }, [dates]);

  const checkAvailability = useCallback(
    async (nextDates = dates) => {
      if (!id) return;
      if (new Date(nextDates.endDate) <= new Date(nextDates.startDate)) {
        setAvailable(false);
        toast.error("Return date must be after the pick-up date.");
        return;
      }

      setChecking(true);
      try {
        const params = new URLSearchParams({
          startDate: nextDates.startDate,
          endDate: nextDates.endDate,
        });
        const response = await fetch(`/api/cars/${id}/availability?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.message || "Unable to check availability.");
        setAvailable(Boolean(payload?.data?.available));
      } catch (requestError: any) {
        setAvailable(null);
        toast.error(requestError?.message || "Unable to check availability.");
      } finally {
        setChecking(false);
      }
    },
    [dates, id],
  );

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();

    const params = new URLSearchParams(window.location.search);
    const requestedDates = normalizeDates(
      params.get("startDate") || defaults.startDate,
      params.get("endDate") || defaults.endDate,
    );
    setDates(requestedDates);

    async function loadCar() {
      setLoading(true);
      setError(null);
      try {
        const [detailResponse, reviewResponse] = await Promise.all([
          fetch(`/api/cars/${id}`, { signal: controller.signal, cache: "no-store" }),
          fetch(`/api/cars/${id}/reviews?limit=6`, { signal: controller.signal, cache: "no-store" }),
        ]);

        const detailPayload = await detailResponse.json();
        if (!detailResponse.ok) throw new Error(detailPayload?.message || "Unable to load this vehicle.");

        const reviewPayload = reviewResponse.ok ? await reviewResponse.json() : null;
        setCar(detailPayload?.data || null);
        setReviews(Array.isArray(reviewPayload?.data) ? reviewPayload.data : []);

        const availabilityParams = new URLSearchParams(requestedDates);
        const availabilityResponse = await fetch(`/api/cars/${id}/availability?${availabilityParams.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (availabilityResponse.ok) {
          const availabilityPayload = await availabilityResponse.json();
          setAvailable(Boolean(availabilityPayload?.data?.available));
        }
      } catch (requestError: any) {
        if (requestError?.name !== "AbortError") {
          setError(requestError?.message || "Unable to load this vehicle.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadCar();
    return () => controller.abort();
  }, [defaults.endDate, defaults.startDate, id]);

  const createBooking = async () => {
    if (!car) return;
    const token = Cookies.get("token");
    if (!token) {
      const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      router.push(`/login?returnTo=${returnTo}`);
      return;
    }

    if (available !== true) {
      toast.error("Check availability before creating a booking request.");
      return;
    }

    setBooking(true);
    try {
      const response = await fetch("/api/customer/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          carId: car.id,
          startDate: dates.startDate,
          endDate: dates.endDate,
          pickupLocation: car.location?.name || car.location?.address || "Ho Chi Minh City",
          dropoffLocation: car.location?.name || car.location?.address || "Ho Chi Minh City",
        }),
      });
      const payload = await response.json();

      if (response.status === 403) {
        toast.error("Complete identity verification before requesting a booking.");
        router.push("/customer/kyc");
        return;
      }

      if (!response.ok) throw new Error(payload?.message || "Unable to create this booking.");

      toast.success("Booking request created.");
      router.push("/customer/bookings");
      router.refresh();
    } catch (requestError: any) {
      toast.error(requestError?.message || "Unable to create this booking.");
    } finally {
      setBooking(false);
    }
  };

  const updateStartDate = (startDate: string) => {
    setDates((current) => normalizeDates(startDate, current.endDate));
    setAvailable(null);
  };

  const updateEndDate = (endDate: string) => {
    setDates((current) => normalizeDates(current.startDate, endDate));
    setAvailable(null);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090909] px-5 py-12 text-white lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="h-10 w-40 animate-pulse rounded-full bg-white/10" />
          <div className="grid gap-8 lg:grid-cols-[1.35fr_.65fr]">
            <div className="h-[560px] animate-pulse rounded-[2rem] bg-white/5" />
            <div className="h-[420px] animate-pulse rounded-[2rem] bg-white/5" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !car) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090909] px-5 text-white">
        <Card className="w-full max-w-lg border-white/10 bg-[#111] text-white">
          <CardHeader>
            <CardTitle>Vehicle unavailable</CardTitle>
            <CardDescription className="text-white/50">{error || "This vehicle could not be found."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-white text-black hover:bg-white/90">
              <Link href="/customer/cars">Back to fleet</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const ownerName = [car.owner?.firstName, car.owner?.lastName].filter(Boolean).join(" ") || "Elite Drive owner";
  const locationName = car.location?.name || car.location?.city || "Ho Chi Minh City";
  const estimatedTotal = Number(car.pricePerDay || 0) * tripDays;

  const specs = [
    { icon: CalendarDays, label: "Year", value: car.year },
    { icon: Gauge, label: "Transmission", value: car.transmission || "Not specified" },
    { icon: Users, label: "Seats", value: car.seatCount ? `${car.seatCount} seats` : "Not specified" },
    { icon: Fuel, label: "Fuel", value: car.fuelType || "Not specified" },
    { icon: Palette, label: "Color", value: car.color || "Not specified" },
    { icon: Car, label: "Category", value: car.category?.name || "Vehicle" },
  ];

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Button asChild variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
            <Link href="/customer/cars"><ArrowLeft className="mr-2 h-4 w-4" /> Back to fleet</Link>
          </Button>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/45">
            <Car className="h-4 w-4" /> Elite Drive
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.35fr_.65fr] lg:items-start">
          <div className="space-y-8">
            <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#111]">
              <div className="relative h-[360px] bg-white/5 sm:h-[520px]">
                <Image
                  src={car.mainImageUrl || "/images/car3.png"}
                  alt={car.name || "Elite Drive vehicle"}
                  fill
                  priority
                  unoptimized
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/90 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-end justify-between gap-5 sm:bottom-8 sm:left-8 sm:right-8">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border border-white/15 bg-black/60 text-white backdrop-blur">Verified marketplace vehicle</Badge>
                      {car.averageRating > 0 ? (
                        <Badge className="border border-white/15 bg-black/60 text-white backdrop-blur">
                          <Star className="mr-1 h-3 w-3 fill-current" /> {Number(car.averageRating).toFixed(1)}
                        </Badge>
                      ) : null}
                    </div>
                    <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">{car.name}</h1>
                    <p className="mt-2 flex items-center gap-2 text-sm text-white/65"><MapPin className="h-4 w-4" /> {locationName}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/55 px-5 py-4 text-right backdrop-blur">
                    <p className="text-xs text-white/45">Daily rate</p>
                    <p className="mt-1 text-2xl font-black">{money(car.pricePerDay)} ₫</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {specs.map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[.035] p-5">
                  <Icon className="h-5 w-5 text-white/55" />
                  <p className="mt-5 text-xs uppercase tracking-[0.15em] text-white/35">{label}</p>
                  <p className="mt-1 font-bold">{String(value)}</p>
                </div>
              ))}
            </section>

            <section className="grid gap-6 md:grid-cols-[1.2fr_.8fr]">
              <Card className="border-white/10 bg-[#111] text-white">
                <CardHeader>
                  <CardTitle>About this vehicle</CardTitle>
                  <CardDescription className="text-white/45">Vehicle information supplied through the marketplace listing.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm leading-7 text-white/65">
                    {car.description || "The owner has not added a detailed description yet."}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-[#111] text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" /> Vehicle owner</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-lg font-bold">{ownerName}</p>
                    <p className="mt-1 text-sm text-white/45">{car.owner?._count?.cars ? `${car.owner._count.cars} vehicle listings` : "Marketplace owner"}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
                    <ShieldCheck className="h-4 w-4" /> Listing approved for marketplace discovery
                  </div>
                </CardContent>
              </Card>
            </section>

            <section>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">Renter feedback</p>
                  <h2 className="mt-2 text-3xl font-black">Reviews</h2>
                </div>
                {car.averageRating > 0 ? (
                  <div className="flex items-center gap-2 text-sm font-bold"><Star className="h-4 w-4 fill-current" /> {Number(car.averageRating).toFixed(1)}</div>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {reviews.length ? reviews.map((review) => (
                  <Card key={review.id || `${review.createdAt}-${review.rating}`} className="border-white/10 bg-[#111] text-white">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-semibold">
                          {[review.customer?.firstName, review.customer?.lastName].filter(Boolean).join(" ") || "Verified renter"}
                        </p>
                        <span className="flex items-center gap-1 text-sm font-bold"><Star className="h-4 w-4 fill-current" /> {review.rating}</span>
                      </div>
                      {review.title ? <p className="mt-4 text-sm font-semibold">{review.title}</p> : null}
                      <p className="mt-2 text-sm leading-6 text-white/55">{review.content || "Rating submitted without a written review."}</p>
                    </CardContent>
                  </Card>
                )) : (
                  <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[.03] p-8 text-sm text-white/50">
                    No written reviews have been published for this vehicle yet.
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-6">
            <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-white text-black shadow-2xl">
              <CardHeader className="border-b border-black/10">
                <CardTitle className="text-2xl">Plan this trip</CardTitle>
                <CardDescription>Dates are checked against bookings and owner-blocked availability.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-black/45">Pick-up</span>
                    <Input
                      type="date"
                      min={dateInputValue(new Date())}
                      value={dates.startDate}
                      onChange={(event) => updateStartDate(event.target.value)}
                    />
                  </label>
                  <label>
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-black/45">Return</span>
                    <Input
                      type="date"
                      min={dateInputValue(new Date(new Date(dates.startDate).getTime() + DAY_MS))}
                      value={dates.endDate}
                      onChange={(event) => updateEndDate(event.target.value)}
                    />
                  </label>
                </div>

                <Button variant="outline" className="w-full" onClick={() => checkAvailability()} disabled={checking}>
                  {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}
                  Check availability
                </Button>

                <div className="rounded-2xl bg-black p-5 text-white">
                  <div className="flex items-center justify-between text-sm text-white/55">
                    <span>{money(car.pricePerDay)} ₫ × {tripDays} day{tripDays === 1 ? "" : "s"}</span>
                    <span>{money(estimatedTotal)} ₫</span>
                  </div>
                  <div className="my-4 border-t border-white/10" />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Estimated total</span>
                    <span className="text-xl font-black">{money(estimatedTotal)} ₫</span>
                  </div>
                </div>

                {available === true ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" /> Available for these dates
                  </div>
                ) : available === false ? (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                    <XCircle className="h-4 w-4" /> Unavailable for these dates
                  </div>
                ) : (
                  <div className="rounded-xl border border-black/10 bg-black/[.025] p-3 text-sm text-black/55">
                    Check availability before creating a booking request.
                  </div>
                )}

                <Button className="h-12 w-full font-bold" onClick={createBooking} disabled={booking || available !== true}>
                  {booking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Car className="mr-2 h-4 w-4" />}
                  Create booking request
                </Button>

                <p className="text-center text-xs leading-5 text-black/45">
                  Creating a request does not charge a payment method. Booking approval and checkout happen later in the workflow.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
