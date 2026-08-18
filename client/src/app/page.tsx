"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Car,
  Check,
  ChevronRight,
  KeyRound,
  MapPin,
  Menu,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";

import { useAuthContext } from "@/components/provider/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  addDaysToDateInput,
  createDefaultTripDates,
  dateInputValue,
  normalizeTripDates,
} from "@/lib/date";

type SearchState = {
  city: string;
  startDate: string;
  endDate: string;
  transmission: string;
};

type FeaturedCar = {
  id: string;
  name?: string;
  mainImageUrl?: string | null;
  averageRating?: number;
  pricePerDay?: number;
  transmission?: string | null;
  seatCount?: number | null;
  location?: { name?: string | null; city?: string | null } | null;
};

const formatCurrency = (value?: number) =>
  typeof value === "number"
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
    : "—";

const workspaceByRole: Record<string, string> = {
  ADMIN: "/admin/kyc",
  OWNER: "/owner/dashboard",
  CUSTOMER: "/customer/bookings",
};

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const defaultDates = useMemo(() => createDefaultTripDates(), []);
  const [search, setSearch] = useState<SearchState>({
    city: "Ho Chi Minh City",
    transmission: "",
    ...defaultDates,
  });
  const [featuredCars, setFeaturedCars] = useState<FeaturedCar[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  const workspaceHref = user?.role ? workspaceByRole[user.role] : null;

  useEffect(() => {
    const controller = new AbortController();

    async function loadFeaturedCars() {
      try {
        const response = await fetch("/api/cars?limit=3", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = await response.json();
        setFeaturedCars(Array.isArray(payload?.data) ? payload.data.slice(0, 3) : []);
      } catch {
        // Discovery remains usable when the preview feed is temporarily unavailable.
      } finally {
        setInventoryLoading(false);
      }
    }

    loadFeaturedCars();
    return () => controller.abort();
  }, []);

  const updateStartDate = (startDate: string) => {
    const normalized = normalizeTripDates(startDate, search.endDate);
    setSearch((current) => ({ ...current, ...normalized }));
    setSearchError(null);
  };

  const updateEndDate = (endDate: string) => {
    setSearch((current) => ({ ...current, endDate }));
    setSearchError(null);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!search.startDate || !search.endDate || search.endDate <= search.startDate) {
      setSearchError("Choose a return date after the pick-up date.");
      return;
    }

    const params = new URLSearchParams();
    if (search.city.trim()) params.set("city", search.city.trim());
    params.set("startDate", search.startDate);
    params.set("endDate", search.endDate);
    if (search.transmission) params.set("transmission", search.transmission);
    router.push(`/customer/cars?${params.toString()}`);
  };

  const vehicleHref = (carId: string) => {
    const params = new URLSearchParams({
      startDate: search.startDate,
      endDate: search.endDate,
    });
    return `/customer/cars/${carId}?${params.toString()}`;
  };

  const accountHref = workspaceHref || "/login";
  const accountLabel = workspaceHref ? "Open workspace" : "Sign in";

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[70] -translate-y-24 rounded-full bg-white px-4 py-2 text-sm font-bold text-black shadow-xl transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-white">
        Skip to content
      </a>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/15 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-5 lg:px-8">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-black"
            aria-label="Elite Drive home">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white text-black">
              <Car className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-[0.2em] sm:tracking-[0.24em]">ELITE DRIVE</p>
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 sm:block">Car rental marketplace</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 text-sm font-medium text-white/75 md:flex" aria-label="Primary navigation">
            <a href="#vehicles" className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Vehicles</a>
            <a href="#how-it-works" className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">How it works</a>
            <a href="#owners" className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">For owners</a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="ghost" className="hidden text-white hover:bg-white/10 hover:text-white lg:inline-flex">
              <Link href={accountHref}>{accountLabel}</Link>
            </Button>
            <Button asChild className="rounded-full bg-white px-4 text-black hover:bg-white/90 sm:px-5">
              <Link href="/customer/cars">Find a car</Link>
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white md:hidden" aria-label="Open navigation">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent className="border-white/15 bg-[#0b0b0b] text-white">
                <SheetHeader className="border-b border-white/15 px-5 pb-5 pt-7">
                  <SheetTitle className="text-left text-white">Elite Drive</SheetTitle>
                  <SheetDescription className="text-left text-white/70">Navigate the marketplace and account tools.</SheetDescription>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-4" aria-label="Mobile navigation">
                  {[{ label: "Vehicles", href: "#vehicles" }, { label: "How it works", href: "#how-it-works" }, { label: "For owners", href: "#owners" }].map((item) => (
                    <SheetClose asChild key={item.href}>
                      <a href={item.href} className="rounded-xl px-4 py-3 text-base font-semibold text-white/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                        {item.label}
                      </a>
                    </SheetClose>
                  ))}
                </nav>
                <div className="mt-auto space-y-2 border-t border-white/15 p-5">
                  <Button asChild variant="outline" className="w-full border-white/35 bg-transparent text-white hover:bg-white hover:text-black">
                    <Link href={accountHref}>{accountLabel}</Link>
                  </Button>
                  <Button asChild className="w-full bg-white text-black hover:bg-white/90">
                    <Link href="/customer/cars">Browse vehicles</Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="relative isolate overflow-hidden pt-20">
          <Image
            src="/images/car3.png"
            alt=""
            aria-hidden="true"
            fill
            priority
            className="object-cover object-center opacity-50"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.97)_0%,rgba(0,0,0,.82)_46%,rgba(0,0,0,.38)_76%,rgba(0,0,0,.72)_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-black/30" />

          <div className="relative mx-auto grid min-h-[780px] max-w-7xl gap-12 px-5 pb-20 pt-24 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-8 lg:pb-24 lg:pt-28">
            <div className="max-w-3xl">
              <Badge className="mb-7 rounded-full border border-white/25 bg-black/40 px-4 py-2 text-white backdrop-blur">
                <BadgeCheck className="mr-2 h-3.5 w-3.5" /> Approved vehicle marketplace
              </Badge>
              <h1 className="text-5xl font-black leading-[0.96] tracking-[-0.055em] sm:text-6xl lg:text-7xl xl:text-[5.5rem]">
                Premium car rental,
                <span className="block text-white/70">without the guesswork.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/80 sm:text-xl">
                Search approved vehicles, check your exact dates, and send a booking request from one place. After approval, follow checkout, trip handover, support, and reviews in the same account.
              </p>

              <div className="mt-9 flex flex-wrap gap-3 text-sm font-medium text-white/80">
                {["Approved listings", "Date-aware availability", "Identity-verified booking", "Owner-managed calendars"].map((item) => (
                  <span key={item} className="flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-4 py-2.5 backdrop-blur">
                    <Check className="h-4 w-4" /> {item}
                  </span>
                ))}
              </div>
            </div>

            <form
              onSubmit={submitSearch}
              aria-describedby="trip-search-help"
              className="self-center rounded-[2rem] border border-white/25 bg-[#0b0b0b]/90 p-5 shadow-2xl backdrop-blur-2xl sm:p-7">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Plan your trip</p>
                  <h2 className="mt-2 text-2xl font-bold">Find a car for your dates</h2>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black">
                  <KeyRound className="h-5 w-5" />
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/75">City</span>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/60" />
                    <Input
                      name="city"
                      value={search.city}
                      onChange={(event) => setSearch((current) => ({ ...current, city: event.target.value }))}
                      className="h-12 border-white bg-white pl-11 text-black placeholder:text-black/60 focus-visible:border-white focus-visible:ring-white/70 dark:bg-white dark:text-black dark:placeholder:text-black/60"
                      placeholder="Ho Chi Minh City"
                      autoComplete="address-level2"
                    />
                  </div>
                </label>

                <label>
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/75">Pick-up</span>
                  <Input
                    name="startDate"
                    type="date"
                    min={dateInputValue(new Date())}
                    value={search.startDate}
                    onChange={(event) => updateStartDate(event.target.value)}
                    className="h-12 border-white/40 bg-white/[.06] text-white [color-scheme:dark] focus-visible:border-white focus-visible:ring-white/60"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/75">Return</span>
                  <Input
                    name="endDate"
                    type="date"
                    min={addDaysToDateInput(search.startDate, 1)}
                    value={search.endDate}
                    onChange={(event) => updateEndDate(event.target.value)}
                    className="h-12 border-white/40 bg-white/[.06] text-white [color-scheme:dark] focus-visible:border-white focus-visible:ring-white/60"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/75">Transmission</span>
                  <select
                    name="transmission"
                    value={search.transmission}
                    onChange={(event) => setSearch((current) => ({ ...current, transmission: event.target.value }))}
                    className="h-12 w-full rounded-md border border-white/40 bg-[#151515] px-4 text-sm text-white outline-none transition focus:border-white focus:ring-2 focus:ring-white/50">
                    <option value="">Any transmission</option>
                    <option value="Automatic">Automatic</option>
                    <option value="Manual">Manual</option>
                  </select>
                </label>
              </div>

              {searchError ? <p role="alert" className="mt-4 rounded-xl border border-red-400/50 bg-red-950/60 px-4 py-3 text-sm font-medium text-red-100">{searchError}</p> : null}

              <Button type="submit" className="mt-5 h-12 w-full rounded-xl bg-white text-base font-bold text-black hover:bg-white/90">
                Show available vehicles <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p id="trip-search-help" className="mt-4 text-center text-xs leading-5 text-white/70">
                Browsing and checking dates are public. A booking request is only created after sign-in and identity verification.
              </p>
            </form>
          </div>
        </section>

        <section id="vehicles" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-24 lg:px-8" aria-busy={inventoryLoading}>
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">Explore the marketplace</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Vehicles worth a closer look.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                These listings come directly from the marketplace feed. Open a vehicle to review its details, owner, renter feedback, and availability for your selected dates.
              </p>
            </div>
            <Button asChild variant="outline" className="w-fit rounded-full border-white/35 bg-transparent text-white hover:bg-white hover:text-black">
              <Link href="/customer/cars">Browse all vehicles <ChevronRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>

          <p className="sr-only" aria-live="polite">
            {inventoryLoading ? "Loading marketplace vehicles" : `${featuredCars.length} marketplace vehicle previews loaded`}
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {inventoryLoading && [0, 1, 2].map((index) => (
              <div key={index} aria-hidden="true" className="h-[430px] animate-pulse rounded-[1.75rem] border border-white/15 bg-white/[.06]" />
            ))}

            {!inventoryLoading && featuredCars.map((car) => (
              <Card key={car.id} className="group overflow-hidden rounded-[1.75rem] border-white/15 bg-[#111] p-0 text-white shadow-none transition hover:border-white/35">
                <Link href={vehicleHref(car.id)} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white">
                  <div className="relative h-60 overflow-hidden bg-white/[.06]">
                    <Image
                      src={car.mainImageUrl || "/images/car3.png"}
                      alt={car.name || "Elite Drive vehicle"}
                      fill
                      unoptimized
                      className="object-cover transition duration-500 motion-safe:group-hover:scale-[1.03]"
                    />
                  </div>
                </Link>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                        {car.location?.name || car.location?.city || "Marketplace listing"}
                      </p>
                      <h3 className="mt-2 truncate text-xl font-bold">
                        <Link href={vehicleHref(car.id)} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                          {car.name || "Elite Drive vehicle"}
                        </Link>
                      </h3>
                    </div>
                    {Number(car.averageRating || 0) > 0 ? (
                      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold" aria-label={`${Number(car.averageRating).toFixed(1)} out of 5 stars`}>
                        <Star className="h-4 w-4 fill-current" /> {Number(car.averageRating).toFixed(1)}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-white/70">
                    {car.transmission ? <span className="rounded-full border border-white/20 px-3 py-1.5">{car.transmission}</span> : null}
                    {car.seatCount ? <span className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5"><Users className="h-3.5 w-3.5" />{car.seatCount} seats</span> : null}
                  </div>

                  <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/15 pt-5">
                    <div>
                      <p className="text-xs font-medium text-white/70">Daily rate</p>
                      <p className="mt-1 text-lg font-black">{formatCurrency(car.pricePerDay)} ₫</p>
                    </div>
                    <Button asChild size="sm" className="rounded-full bg-white text-black hover:bg-white/90">
                      <Link href={vehicleHref(car.id)}>View vehicle <ChevronRight className="ml-1 h-4 w-4" /></Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {!inventoryLoading && featuredCars.length === 0 && (
              <div className="md:col-span-3 rounded-[1.75rem] border border-white/20 bg-white/[.04] p-10 text-center">
                <p className="text-lg font-semibold">Vehicle previews are unavailable right now.</p>
                <p className="mt-2 text-sm text-white/70">Open the full marketplace to retry discovery and apply your trip filters.</p>
                <Button asChild className="mt-5 rounded-full bg-white text-black hover:bg-white/90">
                  <Link href="/customer/cars">Open marketplace</Link>
                </Button>
              </div>
            )}
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 border-y border-white/15 bg-white/[.03]">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:items-start">
              <div className="max-w-xl lg:sticky lg:top-28">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">How it works</p>
                <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">A rental flow you can understand before you start.</h2>
                <p className="mt-5 text-base leading-7 text-white/70">
                  Elite Drive separates discovery, booking approval, checkout, and the trip itself. Each step has a clear state instead of hiding everything behind a single “Book now” button.
                </p>
              </div>

              <div className="grid gap-px overflow-hidden rounded-[2rem] border border-white/15 bg-white/15 sm:grid-cols-2">
                {[
                  { number: "01", title: "Search", body: "Filter approved listings by city, dates, transmission, and price in the marketplace." },
                  { number: "02", title: "Check availability", body: "Date checks account for active bookings and dates the owner has explicitly blocked." },
                  { number: "03", title: "Verify & request", body: "Browse freely, then sign in and complete renter identity verification before creating a booking request." },
                  { number: "04", title: "Manage the trip", body: "Follow owner approval, checkout state, handover, support cases, and post-trip reviews from your account." },
                ].map((step) => (
                  <article key={step.number} className="bg-[#0b0b0b] p-7 sm:p-8">
                    <p className="text-xs font-black tracking-[0.2em] text-white/70">{step.number}</p>
                    <h3 className="mt-10 text-xl font-bold">{step.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/70">{step.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
          <div className="overflow-hidden rounded-[2.25rem] bg-[#f1efe9] text-black">
            <div className="grid lg:grid-cols-[.9fr_1.1fr]">
              <div className="border-b border-black/15 p-8 sm:p-12 lg:border-b-0 lg:border-r lg:p-14">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-black/70">After you request</p>
                <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Know what happens next.</h2>
                <p className="mt-5 text-base leading-7 text-black/70">
                  Creating a booking request does not charge a payment method. The owner reviews the request first; checkout becomes available only after approval.
                </p>
              </div>
              <div className="grid sm:grid-cols-3">
                {[
                  { icon: CalendarDays, title: "Request sent", body: "Your dates, vehicle, and trip locations are stored with a pending booking request." },
                  { icon: Users, title: "Owner decision", body: "The vehicle owner can approve the request or decline it before checkout." },
                  { icon: ShieldCheck, title: "Checkout & trip", body: "After approval, payment state and the rest of the trip lifecycle stay attached to the booking." },
                ].map(({ icon: Icon, title, body }) => (
                  <article key={title} className="border-b border-black/15 p-7 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-white"><Icon className="h-5 w-5" /></span>
                    <h3 className="mt-8 text-lg font-black">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-black/70">{body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="owners" className="scroll-mt-24 mx-auto max-w-7xl px-5 pb-24 lg:px-8">
          <div className="grid gap-8 rounded-[2.25rem] border border-white/15 bg-[#101010] p-8 sm:p-12 lg:grid-cols-[1.05fr_.95fr] lg:p-14">
            <div>
              <Badge className="rounded-full border border-white/25 bg-white/[.06] text-white">For vehicle owners</Badge>
              <h2 className="mt-6 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">Run the rental, not just the listing.</h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
                Owners can submit vehicles for approval, control availability, review booking requests, manage trip handover, track transaction history, and request withdrawals from one workspace.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild className="rounded-full bg-white px-6 text-black hover:bg-white/90">
                  <Link href="/register">Create owner account <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full border-white/35 bg-transparent px-6 text-white hover:bg-white hover:text-black">
                  <Link href="/login?returnTo=%2Fowner%2Fdashboard">Owner sign in</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {["Vehicle approval workflow", "Availability calendar", "Booking request operations", "Trip handover & wallet history"].map((item) => (
                <div key={item} className="flex min-h-28 items-end rounded-2xl border border-white/15 bg-white/[.04] p-5 text-sm font-semibold text-white/90">
                  <span className="mr-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-black"><Check className="h-4 w-4" /></span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/15 bg-white/[.025]">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">Before you book</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Clear answers to the important parts.</h2>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {[
                { question: "What does an approved listing mean?", answer: "The listing passed Elite Drive’s marketplace approval workflow before appearing in discovery. It does not imply an independent third-party vehicle certification." },
                { question: "When do I pay?", answer: "Creating a booking request does not charge a payment method. Checkout becomes available after the vehicle owner approves the request." },
                { question: "Why is identity verification required?", answer: "Browsing and availability checks are public. Creating a customer booking request requires approved identity verification." },
              ].map((item) => (
                <article key={item.question} className="rounded-2xl border border-white/15 bg-[#0c0c0c] p-7">
                  <h3 className="text-lg font-bold">{item.question}</h3>
                  <p className="mt-4 text-sm leading-6 text-white/70">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
          <div className="rounded-[2rem] border border-white/15 bg-white/[.05] px-7 py-12 text-center sm:px-12 sm:py-16">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">Start with the car</p>
            <h2 className="mx-auto mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Choose a vehicle. Check the dates. Decide from there.</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/70">You can browse the marketplace and review availability before creating an account.</p>
            <Button asChild size="lg" className="mt-8 h-12 rounded-full bg-white px-8 text-black hover:bg-white/90">
              <Link href="/customer/cars">Browse marketplace <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <Link href="/" className="flex w-fit items-center gap-3 rounded-lg text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <Car className="h-5 w-5" />
            <span className="font-black tracking-[0.18em]">ELITE DRIVE</span>
          </Link>
          <p>Approved vehicle discovery and rental operations for renters and owners.</p>
          <nav className="flex flex-wrap gap-5" aria-label="Footer navigation">
            <Link href="/customer/cars" className="rounded-sm hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Vehicles</Link>
            <Link href="/register" className="rounded-sm hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Create account</Link>
            <Link href={accountHref} className="rounded-sm hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{accountLabel}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
