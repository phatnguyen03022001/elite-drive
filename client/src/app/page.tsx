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
  Clock3,
  Gauge,
  KeyRound,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const formatDate = (date: Date) => date.toISOString().split("T")[0];

const formatCurrency = (value?: number) =>
  typeof value === "number"
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
    : "—";

export default function HomePage() {
  const router = useRouter();
  const defaultDates = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + 1);
    return { startDate: formatDate(start), endDate: formatDate(end) };
  }, []);

  const [search, setSearch] = useState({
    city: "Ho Chi Minh City",
    transmission: "",
    ...defaultDates,
  });
  const [featuredCars, setFeaturedCars] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);

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
        // The landing page stays usable when inventory is temporarily unavailable.
      } finally {
        setInventoryLoading(false);
      }
    }

    loadFeaturedCars();
    return () => controller.abort();
  }, []);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (search.city.trim()) params.set("city", search.city.trim());
    if (search.startDate) params.set("startDate", search.startDate);
    if (search.endDate) params.set("endDate", search.endDate);
    if (search.transmission) params.set("transmission", search.transmission);
    router.push(`/customer/cars?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Elite Drive home">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white text-black">
              <Car className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black tracking-[0.24em]">ELITE DRIVE</p>
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">Premium mobility</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-white/70 md:flex" aria-label="Primary navigation">
            <a href="#fleet" className="transition hover:text-white">Fleet</a>
            <a href="#experience" className="transition hover:text-white">Experience</a>
            <a href="#owners" className="transition hover:text-white">For owners</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden text-white hover:bg-white/10 hover:text-white sm:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="rounded-full bg-white px-5 text-black hover:bg-white/90">
              <Link href="/customer/cars">Find a car</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative isolate min-h-[820px] overflow-hidden pt-20">
        <Image
          src="/images/car3.png"
          alt="Premium vehicle available through Elite Drive"
          fill
          priority
          className="object-cover object-center opacity-55"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.96)_0%,rgba(0,0,0,.72)_42%,rgba(0,0,0,.28)_72%,rgba(0,0,0,.72)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-black/20" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-28 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pt-36">
          <div className="max-w-3xl">
            <Badge className="mb-7 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-white backdrop-blur">
              <Sparkles className="mr-2 h-3.5 w-3.5" /> Premium car rental platform
            </Badge>
            <h1 className="text-5xl font-black leading-[.98] tracking-[-0.055em] sm:text-6xl lg:text-8xl">
              Drive something
              <span className="block text-white/45">worth remembering.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/65 sm:text-xl">
              Discover verified vehicles, check availability, book securely, and manage every trip from one account.
            </p>

            <div className="mt-9 flex flex-wrap gap-3 text-sm text-white/70">
              {["Inventory search", "Verified accounts", "Booking management", "Owner operations"].map((item) => (
                <span key={item} className="flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 backdrop-blur">
                  <Check className="h-4 w-4 text-white" /> {item}
                </span>
              ))}
            </div>
          </div>

          <form onSubmit={submitSearch} className="self-end rounded-[2rem] border border-white/15 bg-black/65 p-5 shadow-2xl backdrop-blur-2xl sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">Start your trip</p>
                <h2 className="mt-2 text-2xl font-bold">Search availability</h2>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black">
                <KeyRound className="h-5 w-5" />
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/45">City</span>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                  <Input
                    value={search.city}
                    onChange={(event) => setSearch((current) => ({ ...current, city: event.target.value }))}
                    className="h-12 border-0 bg-white pl-11 text-black placeholder:text-black/40"
                    placeholder="Ho Chi Minh City"
                  />
                </div>
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/45">Pick-up</span>
                <Input
                  type="date"
                  min={formatDate(new Date())}
                  value={search.startDate}
                  onChange={(event) => setSearch((current) => ({ ...current, startDate: event.target.value }))}
                  className="h-12 border-white/10 bg-white/5 text-white [color-scheme:dark]"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/45">Return</span>
                <Input
                  type="date"
                  min={search.startDate}
                  value={search.endDate}
                  onChange={(event) => setSearch((current) => ({ ...current, endDate: event.target.value }))}
                  className="h-12 border-white/10 bg-white/5 text-white [color-scheme:dark]"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/45">Transmission</span>
                <select
                  value={search.transmission}
                  onChange={(event) => setSearch((current) => ({ ...current, transmission: event.target.value }))}
                  className="h-12 w-full rounded-md border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-white/30">
                  <option value="" className="text-black">Any transmission</option>
                  <option value="Automatic" className="text-black">Automatic</option>
                  <option value="Manual" className="text-black">Manual</option>
                </select>
              </label>
            </div>

            <Button type="submit" className="mt-5 h-12 w-full rounded-xl bg-white text-base font-bold text-black hover:bg-white/90">
              Search available cars <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="mt-4 text-center text-xs leading-5 text-white/40">Search criteria are passed to the marketplace inventory API.</p>
          </form>
        </div>
      </section>

      <section id="fleet" className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/40">Marketplace inventory</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Available vehicles.</h2>
          </div>
          <Button asChild variant="outline" className="w-fit rounded-full border-white/20 bg-transparent text-white hover:bg-white hover:text-black">
            <Link href="/customer/cars">Browse the full fleet <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {inventoryLoading && [0, 1, 2].map((index) => (
            <div key={index} className="h-[410px] animate-pulse rounded-[1.75rem] border border-white/10 bg-white/5" />
          ))}

          {!inventoryLoading && featuredCars.map((car) => (
            <Card key={car.id} className="group overflow-hidden rounded-[1.75rem] border-white/10 bg-[#111] text-white">
              <div className="relative h-60 overflow-hidden bg-white/5">
                <Image
                  src={car.mainImageUrl || "/images/car3.png"}
                  alt={car.name || "Elite Drive vehicle"}
                  fill
                  unoptimized
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">{car.transmission || "Vehicle"}</p>
                    <h3 className="mt-2 text-xl font-bold">{car.name || "Premium vehicle"}</h3>
                  </div>
                  {car.averageRating > 0 ? (
                    <span className="flex items-center gap-1 text-sm">
                      <Star className="h-4 w-4 fill-white" /> {Number(car.averageRating).toFixed(1)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-5">
                  <div>
                    <p className="text-xs text-white/40">From</p>
                    <p className="text-lg font-black">{formatCurrency(car.pricePerDay)} ₫ <span className="text-xs font-normal text-white/40">/ day</span></p>
                  </div>
                  <Button asChild size="sm" className="rounded-full bg-white text-black hover:bg-white/90">
                    <Link href="/customer/cars">Book</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {!inventoryLoading && featuredCars.length === 0 && (
            <div className="md:col-span-3 rounded-[1.75rem] border border-white/10 bg-white/[.03] p-10 text-center">
              <p className="text-lg font-semibold">Inventory is temporarily unavailable.</p>
              <p className="mt-2 text-sm text-white/45">The marketplace remains accessible; try the fleet view again shortly.</p>
              <Button asChild className="mt-5 rounded-full bg-white text-black hover:bg-white/90">
                <Link href="/customer/cars">Open fleet</Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      <section id="experience" className="border-y border-white/10 bg-white/[.025]">
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/40">Built around the actual trip</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">From search to return, one workflow.</h2>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: CalendarDays, title: "Search & availability", body: "Filter the marketplace by dates, location, price and transmission." },
              { icon: BadgeCheck, title: "Verified access", body: "Authentication and identity workflows separate renters, owners and administrators." },
              { icon: WalletCards, title: "Booking lifecycle", body: "Create bookings, track trip status and manage customer payment workflows." },
              { icon: ShieldCheck, title: "Owner operations", body: "Owners manage vehicles, bookings, calendars, trips, profile and wallet tools." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-[#0b0b0b] p-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-8 text-lg font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/45">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="owners" className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <div className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-white text-black">
          <div className="grid lg:grid-cols-[1.1fr_.9fr]">
            <div className="p-8 sm:p-12 lg:p-16">
              <Badge variant="outline" className="rounded-full border-black/15">For vehicle owners</Badge>
              <h2 className="mt-6 max-w-xl text-4xl font-black tracking-tight sm:text-5xl">Your fleet deserves more than a listing page.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-black/60">
                Elite Drive includes operational tools for inventory, availability calendars, bookings, trips, account verification and wallet management.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {["Vehicle management", "Availability calendar", "Booking operations", "Trip & wallet views"].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm font-semibold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white"><Check className="h-4 w-4" /></span>
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-10 flex flex-wrap gap-3">
                <Button asChild className="rounded-full px-6">
                  <Link href="/login">Owner sign in <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full px-6">
                  <Link href="/owner/dashboard">Owner workspace</Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 border-t border-black/10 bg-[#f3f3f3] lg:border-l lg:border-t-0">
              {[
                { icon: Gauge, label: "Fleet", value: "Manage" },
                { icon: Clock3, label: "Availability", value: "Schedule" },
                { icon: Users, label: "Bookings", value: "Operate" },
                { icon: ShieldCheck, label: "Identity", value: "Verify" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex min-h-48 flex-col justify-between border-b border-r border-black/10 p-7">
                  <Icon className="h-6 w-6" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-black/40">{label}</p>
                    <p className="mt-1 text-xl font-black">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8">
        <div className="rounded-[2rem] border border-white/10 bg-white/[.04] px-7 py-12 text-center sm:px-12 sm:py-16">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/40">Ready when you are</p>
          <h2 className="mx-auto mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Choose the car. Confirm the dates. Own the drive.</h2>
          <Button asChild size="lg" className="mt-8 rounded-full bg-white px-8 text-black hover:bg-white/90">
            <Link href="/customer/cars">Browse availability <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-3 text-white">
            <Car className="h-5 w-5" />
            <span className="font-black tracking-[0.18em]">ELITE DRIVE</span>
          </div>
          <p>Premium car rental operations, built for renters and owners.</p>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-white">Sign in</Link>
            <Link href="/customer/cars" className="hover:text-white">Fleet</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
