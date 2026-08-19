"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

import { useAuthContext } from "@/components/provider/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addDaysToDateInput,
  createDefaultTripDates,
  dateInputValue,
  normalizeTripDates,
  tripLengthDays,
  type TripDates,
} from "@/lib/date";

type Review = {
  id?: string;
  rating: number;
  title?: string | null;
  content?: string | null;
  createdAt?: string;
  customer?: { firstName?: string | null; lastName?: string | null } | null;
};

type CarDetail = {
  id: string;
  name: string;
  mainImageUrl?: string | null;
  averageRating?: number | null;
  pricePerDay?: number;
  year?: number | null;
  transmission?: string | null;
  seatCount?: number | null;
  fuelType?: string | null;
  color?: string | null;
  description?: string | null;
  category?: { name?: string | null } | null;
  location?: {
    name?: string | null;
    city?: string | null;
    address?: string | null;
  } | null;
  owner?: {
    firstName?: string | null;
    lastName?: string | null;
    _count?: { cars?: number } | null;
  } | null;
};

type ApiEnvelope<T> = { data?: T; message?: string };

const money = (value?: number) =>
  typeof value === "number"
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
    : "—";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === "object" ? (value as ApiEnvelope<T>) : {};
  } catch {
    return {};
  }
}

export default function CarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthContext();
  const defaults = useMemo(() => createDefaultTripDates(), []);

  const [car, setCar] = useState<CarDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [dates, setDates] = useState<TripDates>(defaults);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tripDays = useMemo(
    () => tripLengthDays(dates.startDate, dates.endDate),
    [dates.endDate, dates.startDate],
  );

  const returnToLogin = useCallback(() => {
    const returnTo = encodeURIComponent(
      `${window.location.pathname}${window.location.search}`,
    );
    router.push(`/login?returnTo=${returnTo}`);
  }, [router]);

  const checkAvailability = useCallback(
    async (nextDates = dates) => {
      if (!id) return;
      if (
        !nextDates.startDate ||
        !nextDates.endDate ||
        nextDates.endDate <= nextDates.startDate
      ) {
        setAvailable(false);
        toast.error("Choose a return date after the pick-up date.");
        return;
      }

      setChecking(true);
      try {
        const params = new URLSearchParams({
          startDate: nextDates.startDate,
          endDate: nextDates.endDate,
        });
        const response = await fetch(
          `/api/cars/${id}/availability?${params.toString()}`,
          { cache: "no-store" },
        );
        const payload = await readEnvelope<{ available?: boolean }>(response);
        if (!response.ok) {
          throw new Error(payload.message || "Unable to check availability.");
        }
        setAvailable(Boolean(payload.data?.available));
      } catch (requestError: unknown) {
        setAvailable(null);
        toast.error(errorMessage(requestError, "Unable to check availability."));
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
    const requestedDates = normalizeTripDates(
      params.get("startDate") || defaults.startDate,
      params.get("endDate") || defaults.endDate,
    );
    setDates(requestedDates);

    async function loadCar() {
      setLoading(true);
      setError(null);
      try {
        const [detailResponse, reviewResponse] = await Promise.all([
          fetch(`/api/cars/${id}`, {
            signal: controller.signal,
            cache: "no-store",
          }),
          fetch(`/api/cars/${id}/reviews?limit=6`, {
            signal: controller.signal,
            cache: "no-store",
          }),
        ]);

        const detailPayload = await readEnvelope<CarDetail>(detailResponse);
        if (!detailResponse.ok || !detailPayload.data) {
          throw new Error(detailPayload.message || "Unable to load this vehicle.");
        }

        const reviewPayload = reviewResponse.ok
          ? await readEnvelope<Review[]>(reviewResponse)
          : {};
        setCar(detailPayload.data);
        setReviews(Array.isArray(reviewPayload.data) ? reviewPayload.data : []);

        const availabilityParams = new URLSearchParams(requestedDates);
        const availabilityResponse = await fetch(
          `/api/cars/${id}/availability?${availabilityParams.toString()}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (availabilityResponse.ok) {
          const availabilityPayload = await readEnvelope<{ available?: boolean }>(
            availabilityResponse,
          );
          setAvailable(Boolean(availabilityPayload.data?.available));
        }
      } catch (requestError: unknown) {
        if (
          !(requestError instanceof DOMException && requestError.name === "AbortError")
        ) {
          setError(errorMessage(requestError, "Unable to load this vehicle."));
        }
      } finally {
        setLoading(false);
      }
    }

    void loadCar();
    return () => controller.abort();
  }, [defaults.endDate, defaults.startDate, id]);

  const createBooking = async () => {
    if (!car || authLoading) return;
    if (!user) {
      returnToLogin();
      return;
    }
    if (user.role !== "CUSTOMER") {
      toast.error("Booking requests are available to renter accounts.");
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
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId: car.id,
          startDate: dates.startDate,
          endDate: dates.endDate,
          pickupLocation:
            car.location?.name || car.location?.address || "Ho Chi Minh City",
          dropoffLocation:
            car.location?.name || car.location?.address || "Ho Chi Minh City",
        }),
      });
      const payload = await readEnvelope<unknown>(response);

      if (response.status === 401) {
        toast.error("Your session has expired. Sign in again to continue.");
        returnToLogin();
        return;
      }
      if (response.status === 403) {
        toast.error("Complete identity verification before requesting a booking.");
        router.push("/customer/kyc");
        return;
      }
      if (!response.ok) {
        throw new Error(payload.message || "Unable to create this booking.");
      }

      toast.success("Booking request created.");
      router.push("/customer/bookings");
      router.refresh();
    } catch (requestError: unknown) {
      toast.error(errorMessage(requestError, "Unable to create this booking."));
    } finally {
      setBooking(false);
    }
  };

  const updateStartDate = (startDate: string) => {
    setDates((current) => normalizeTripDates(startDate, current.endDate));
    setAvailable(null);
  };

  const updateEndDate = (endDate: string) => {
    setDates((current) => normalizeTripDates(current.startDate, endDate));
    setAvailable(null);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090909] px-5 py-12 text-white lg:px-8">
        <div
          className="mx-auto max-w-7xl space-y-8"
          aria-busy="true"
          aria-label="Loading vehicle">
          <div className="h-10 w-40 animate-pulse rounded-full bg-white/10" />
          <div className="grid gap-8 lg:grid-cols-[1.35fr_.65fr]">
            <div className="h-[560px] animate-pulse rounded-[2rem] bg-white/[.06]" />
            <div className="h-[420px] animate-pulse rounded-[2rem] bg-white/[.06]" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !car) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090909] px-5 text-white">
        <Card className="w-full max-w-lg border-white/20 bg-[#111] text-white">
          <CardHeader>
            <CardTitle>Vehicle unavailable</CardTitle>
            <CardDescription className="text-white/70">
              {error || "This vehicle could not be found."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-white text-black hover:bg-white/90">
              <Link href="/customer/cars">Back to marketplace</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const ownerName =
    [car.owner?.firstName, car.owner?.lastName].filter(Boolean).join(" ") ||
    "Marketplace owner";
  const locationName =
    car.location?.name || car.location?.city || "Location on listing";
  const estimatedTotal = Number(car.pricePerDay || 0) * tripDays;
  const computedRating =
    Number(car.averageRating || 0) > 0
      ? Number(car.averageRating)
      : reviews.length
        ? reviews.reduce(
            (sum, review) => sum + Number(review.rating || 0),
            0,
          ) / reviews.length
        : 0;
  const specs = [
    { icon: CalendarDays, label: "Year", value: car.year || "Not specified" },
    {
      icon: Gauge,
      label: "Transmission",
      value: car.transmission || "Not specified",
    },
    {
      icon: Users,
      label: "Seats",
      value: car.seatCount ? `${car.seatCount} seats` : "Not specified",
    },
    { icon: Fuel, label: "Fuel", value: car.fuelType || "Not specified" },
    { icon: Palette, label: "Color", value: car.color || "Not specified" },
    { icon: Car, label: "Category", value: car.category?.name || "Vehicle" },
  ];
  const renterOnly = Boolean(user?.role && user.role !== "CUSTOMER");

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <header className="border-b border-white/15 bg-black/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <Button
            asChild
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white">
            <Link href="/customer/cars">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to marketplace
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/70">
            <Car className="h-4 w-4" /> Elite Drive
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.35fr_.65fr] lg:items-start">
          <div className="space-y-8">
            <section className="overflow-hidden rounded-[2rem] border border-white/15 bg-[#111]">
              <div className="relative h-[360px] bg-white/[.06] sm:h-[520px]">
                <Image
                  src={car.mainImageUrl || "/images/car3.png"}
                  alt={car.name || "Elite Drive vehicle"}
                  fill
                  priority
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/70 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-end justify-between gap-5 sm:bottom-8 sm:left-8 sm:right-8">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border border-white/25 bg-black/75 text-white backdrop-blur">
                        Approved marketplace listing
                      </Badge>
                      {computedRating > 0 ? (
                        <Badge className="border border-white/25 bg-black/75 text-white backdrop-blur">
                          <Star className="mr-1 h-3 w-3 fill-current" />{" "}
                          {computedRating.toFixed(1)}
                        </Badge>
                      ) : null}
                    </div>
                    <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
                      {car.name}
                    </h1>
                    <p className="mt-2 flex items-center gap-2 text-sm text-white/75">
                      <MapPin className="h-4 w-4" /> {locationName}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/20 bg-black/75 px-5 py-4 text-right backdrop-blur">
                    <p className="text-xs font-medium text-white/70">Daily rate</p>
                    <p className="mt-1 text-2xl font-black">
                      {money(car.pricePerDay)} ₫
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              aria-label="Vehicle specifications">
              {specs.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/15 bg-white/[.04] p-5">
                  <Icon className="h-5 w-5 text-white/70" />
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.15em] text-white/70">
                    {label}
                  </p>
                  <p className="mt-1 font-bold">{String(value)}</p>
                </div>
              ))}
            </section>

            <section className="grid gap-6 md:grid-cols-[1.2fr_.8fr]">
              <Card className="border-white/15 bg-[#111] text-white">
                <CardHeader>
                  <CardTitle>About this vehicle</CardTitle>
                  <CardDescription className="text-white/70">
                    Listing information supplied by the vehicle owner.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm leading-7 text-white/75">
                    {car.description ||
                      "The owner has not added a detailed description yet."}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-white/15 bg-[#111] text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserRound className="h-5 w-5" /> Vehicle owner
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-lg font-bold">{ownerName}</p>
                    <p className="mt-1 text-sm text-white/70">
                      {car.owner?._count?.cars
                        ? `${car.owner._count.cars} vehicle listings`
                        : "Marketplace owner"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/[.05] p-3 text-sm text-white/75">
                    <ShieldCheck className="h-4 w-4" /> Listing passed the
                    marketplace approval workflow
                  </div>
                </CardContent>
              </Card>
            </section>

            <section>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                    Renter feedback
                  </p>
                  <h2 className="mt-2 text-3xl font-black">Reviews</h2>
                </div>
                {computedRating > 0 ? (
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Star className="h-4 w-4 fill-current" />{" "}
                    {computedRating.toFixed(1)}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {reviews.length ? (
                  reviews.map((review) => (
                    <Card
                      key={review.id || `${review.createdAt}-${review.rating}`}
                      className="border-white/15 bg-[#111] text-white">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-semibold">
                            {[review.customer?.firstName, review.customer?.lastName]
                              .filter(Boolean)
                              .join(" ") || "Renter"}
                          </p>
                          <span className="flex items-center gap-1 text-sm font-bold">
                            <Star className="h-4 w-4 fill-current" /> {review.rating}
                          </span>
                        </div>
                        {review.title ? (
                          <p className="mt-4 text-sm font-semibold">{review.title}</p>
                        ) : null}
                        <p className="mt-2 text-sm leading-6 text-white/70">
                          {review.content ||
                            "Rating submitted without a written review."}
                        </p>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/15 bg-white/[.04] p-8 text-sm text-white/70 md:col-span-2">
                    No written reviews have been published for this vehicle yet.
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-6">
            <Card className="overflow-hidden rounded-[2rem] border-black/10 bg-white text-black shadow-2xl dark:bg-white dark:text-black">
              <CardHeader className="border-b border-black/15">
                <CardTitle className="text-2xl">Plan this trip</CardTitle>
                <CardDescription className="text-black/60">
                  Check the exact dates before you create a booking request.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-black/60">
                      Pick-up
                    </span>
                    <Input
                      type="date"
                      min={dateInputValue(new Date())}
                      value={dates.startDate}
                      onChange={(event) => updateStartDate(event.target.value)}
                    />
                  </label>
                  <label>
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-black/60">
                      Return
                    </span>
                    <Input
                      type="date"
                      min={addDaysToDateInput(dates.startDate, 1)}
                      value={dates.endDate}
                      onChange={(event) => updateEndDate(event.target.value)}
                    />
                  </label>
                </div>

                <Button
                  variant="outline"
                  className="w-full border-black/30 bg-white text-black hover:bg-black hover:text-white"
                  onClick={() => void checkAvailability()}
                  disabled={checking}>
                  {checking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CalendarDays className="mr-2 h-4 w-4" />
                  )}
                  Check availability
                </Button>

                <div className="rounded-2xl bg-black p-5 text-white">
                  <div className="flex items-center justify-between gap-4 text-sm text-white/70">
                    <span>
                      {money(car.pricePerDay)} ₫ × {tripDays} day
                      {tripDays === 1 ? "" : "s"}
                    </span>
                    <span>{money(estimatedTotal)} ₫</span>
                  </div>
                  <div className="my-4 border-t border-white/15" />
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold">Estimated total</span>
                    <span className="text-xl font-black">
                      {money(estimatedTotal)} ₫
                    </span>
                  </div>
                </div>

                {available === true ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
                    <CheckCircle2 className="h-4 w-4" /> Available for these dates
                  </div>
                ) : available === false ? (
                  <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900">
                    <XCircle className="h-4 w-4" /> Unavailable for these dates
                  </div>
                ) : (
                  <div className="rounded-xl border border-black/20 bg-black/[.03] p-3 text-sm text-black/60">
                    Check availability before creating a booking request.
                  </div>
                )}

                {renterOnly ? (
                  <div className="rounded-xl border border-black/20 bg-black/[.03] p-3 text-sm text-black/60">
                    You are signed in with a {String(user?.role).toLowerCase()} account.
                    Booking requests require a renter account.
                  </div>
                ) : null}

                <Button
                  className="h-12 w-full font-bold"
                  onClick={() => void createBooking()}
                  disabled={
                    booking || authLoading || available !== true || renterOnly
                  }>
                  {booking || authLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Car className="mr-2 h-4 w-4" />
                  )}
                  {renterOnly ? "Renter account required" : "Create booking request"}
                </Button>

                <p className="text-center text-xs leading-5 text-black/60">
                  Creating a request does not charge a payment method. The owner
                  reviews the request before checkout becomes available.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
