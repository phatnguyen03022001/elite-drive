"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addDaysToDateInput,
  createDefaultTripDates,
  dateInputValue,
  normalizeTripDates,
  tripLengthDays,
} from "@/lib/date";

type SearchState = {
  city: string;
  startDate: string;
  endDate: string;
  transmission: string;
  minPrice: string;
  maxPrice: string;
};

type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  lastPage: number;
};

type CarListing = {
  id: string;
  name?: string;
  mainImageUrl?: string | null;
  pricePerDay?: number;
  transmission?: string | null;
  seatCount?: number | null;
  averageRating?: number;
  location?: { name?: string | null; city?: string | null } | null;
};

const PAGE_SIZE = 12;

const money = (value?: number) =>
  typeof value === "number"
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
    : "—";

function defaultSearch(): SearchState {
  return {
    city: "",
    transmission: "",
    minPrice: "",
    maxPrice: "",
    ...createDefaultTripDates(),
  };
}

function validateSearch(query: SearchState) {
  if (!query.startDate || !query.endDate || query.endDate <= query.startDate) {
    return "Choose a return date after the pick-up date.";
  }

  const minPrice = query.minPrice ? Number(query.minPrice) : null;
  const maxPrice = query.maxPrice ? Number(query.maxPrice) : null;
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return "Maximum price must be greater than or equal to minimum price.";
  }

  return null;
}

export default function FleetPage() {
  const [query, setQuery] = useState<SearchState>(defaultSearch);
  const [cars, setCars] = useState<CarListing[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tripDays = useMemo(
    () => tripLengthDays(query.startDate, query.endDate),
    [query.endDate, query.startDate],
  );

  const buildParams = useCallback((nextQuery: SearchState, nextPage = 1) => {
    const params = new URLSearchParams();
    if (nextQuery.city.trim()) params.set("city", nextQuery.city.trim());
    if (nextQuery.startDate) params.set("startDate", nextQuery.startDate);
    if (nextQuery.endDate) params.set("endDate", nextQuery.endDate);
    if (nextQuery.transmission) params.set("transmission", nextQuery.transmission);
    if (nextQuery.minPrice) params.set("minPrice", nextQuery.minPrice);
    if (nextQuery.maxPrice) params.set("maxPrice", nextQuery.maxPrice);
    params.set("page", String(nextPage));
    params.set("limit", String(PAGE_SIZE));
    return params;
  }, []);

  const syncUrl = useCallback((params: URLSearchParams) => {
    if (typeof window === "undefined") return;
    const visibleParams = new URLSearchParams(params);
    visibleParams.delete("limit");
    if (visibleParams.get("page") === "1") visibleParams.delete("page");
    const suffix = visibleParams.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${suffix ? `?${suffix}` : ""}`);
  }, []);

  const fetchCars = useCallback(async (nextQuery: SearchState, nextPage = 1, sync = true) => {
    const validationError = validateSearch(nextQuery);
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const params = buildParams(nextQuery, nextPage);
      const response = await fetch(`/api/cars?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "Unable to load vehicles.");

      const data = Array.isArray(payload?.data) ? payload.data : [];
      setCars(data);
      setMeta(payload?.meta ?? null);
      setPage(Number(payload?.meta?.page || nextPage));
      if (sync) syncUrl(params);
      return true;
    } catch (requestError: any) {
      setCars([]);
      setMeta(null);
      setError(requestError?.message || "The marketplace is temporarily unavailable.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [buildParams, syncUrl]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const base = defaultSearch();
    const rawPage = Number(params.get("page") || 1);
    const initialPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const initialQuery: SearchState = {
      city: params.get("city") || base.city,
      startDate: params.get("startDate") || base.startDate,
      endDate: params.get("endDate") || base.endDate,
      transmission: params.get("transmission") || base.transmission,
      minPrice: params.get("minPrice") || base.minPrice,
      maxPrice: params.get("maxPrice") || base.maxPrice,
    };
    const normalized = normalizeTripDates(initialQuery.startDate, initialQuery.endDate);
    const nextQuery = { ...initialQuery, ...normalized };
    setQuery(nextQuery);
    void fetchCars(nextQuery, initialPage, false);
  }, [fetchCars]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void fetchCars(query, 1);
  };

  const resetFilters = () => {
    const next = defaultSearch();
    setQuery(next);
    void fetchCars(next, 1);
  };

  const updateStartDate = (startDate: string) => {
    setQuery((current) => ({ ...current, ...normalizeTripDates(startDate, current.endDate) }));
    setError(null);
  };

  const detailHref = (carId: string) => {
    const params = new URLSearchParams({
      startDate: query.startDate,
      endDate: query.endDate,
    });
    return `/customer/cars/${carId}?${params.toString()}`;
  };

  const changePage = async (nextPage: number) => {
    if (nextPage < 1 || (meta && nextPage > meta.lastPage) || loading) return;
    const succeeded = await fetchCars(query, nextPage);
    if (succeeded) document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const totalResults = meta?.total ?? cars.length;

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <header className="border-b border-white/15 bg-black/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black">
              <Car className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-[0.2em]">ELITE DRIVE</p>
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 sm:block">Vehicle marketplace</p>
            </div>
          </Link>
          <Button asChild variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
            <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Home</Link>
          </Button>
        </div>
      </header>

      <section className="border-b border-white/15 bg-white/[.03]">
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <Badge className="rounded-full border border-white/20 bg-white/[.06] text-white">Date-aware discovery</Badge>
              <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">Find a car that fits the trip.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                Search approved marketplace listings by location, dates, transmission, and daily price. Open any vehicle to review its details before requesting a booking.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-white/70">
              <ShieldCheck className="h-4 w-4" /> Approved marketplace listings
            </div>
          </div>

          <form onSubmit={submitSearch} className="mt-9 rounded-[1.75rem] border border-white/20 bg-black/40 p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-bold"><SlidersHorizontal className="h-4 w-4" /> Search filters</div>
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters} className="text-white/70 hover:bg-white/10 hover:text-white">Reset</Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <label className="xl:col-span-2">
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-white/75">City</span>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
                  <Input
                    value={query.city}
                    onChange={(event) => setQuery((value) => ({ ...value, city: event.target.value }))}
                    placeholder="Ho Chi Minh City"
                    autoComplete="address-level2"
                    className="h-11 border-white/40 bg-white/[.06] pl-9 text-white placeholder:text-white/60 focus-visible:border-white focus-visible:ring-white/60"
                  />
                </div>
              </label>

              <label>
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-white/75">Pick-up</span>
                <Input
                  type="date"
                  min={dateInputValue(new Date())}
                  value={query.startDate}
                  onChange={(event) => updateStartDate(event.target.value)}
                  className="h-11 border-white/40 bg-white/[.06] text-white [color-scheme:dark] focus-visible:border-white focus-visible:ring-white/60"
                />
              </label>

              <label>
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-white/75">Return</span>
                <Input
                  type="date"
                  min={addDaysToDateInput(query.startDate, 1)}
                  value={query.endDate}
                  onChange={(event) => { setQuery((value) => ({ ...value, endDate: event.target.value })); setError(null); }}
                  className="h-11 border-white/40 bg-white/[.06] text-white [color-scheme:dark] focus-visible:border-white focus-visible:ring-white/60"
                />
              </label>

              <label>
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-white/75">Transmission</span>
                <select
                  value={query.transmission}
                  onChange={(event) => setQuery((value) => ({ ...value, transmission: event.target.value }))}
                  className="h-11 w-full rounded-md border border-white/40 bg-[#151515] px-3 text-sm text-white outline-none transition focus:border-white focus:ring-2 focus:ring-white/50">
                  <option value="">Any</option>
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                </select>
              </label>

              <div className="flex items-end">
                <Button type="submit" disabled={loading} className="h-11 w-full bg-white font-bold text-black hover:bg-white/90">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Search
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:max-w-xl">
              <label>
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-white/75">Min price / day</span>
                <Input
                  inputMode="numeric"
                  value={query.minPrice}
                  onChange={(event) => { setQuery((value) => ({ ...value, minPrice: event.target.value.replace(/\D/g, "") })); setError(null); }}
                  placeholder="0"
                  className="h-11 border-white/40 bg-white/[.06] text-white placeholder:text-white/60 focus-visible:border-white focus-visible:ring-white/60"
                />
              </label>
              <label>
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-white/75">Max price / day</span>
                <Input
                  inputMode="numeric"
                  value={query.maxPrice}
                  onChange={(event) => { setQuery((value) => ({ ...value, maxPrice: event.target.value.replace(/\D/g, "") })); setError(null); }}
                  placeholder="No limit"
                  className="h-11 border-white/40 bg-white/[.06] text-white placeholder:text-white/60 focus-visible:border-white focus-visible:ring-white/60"
                />
              </label>
            </div>

            {error ? <p role="alert" className="mt-5 rounded-xl border border-red-400/50 bg-red-950/60 px-4 py-3 text-sm font-medium text-red-100">{error}</p> : null}
          </form>
        </div>
      </section>

      <section id="results" className="scroll-mt-6 mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/70" aria-live="polite">
              {loading ? "Searching marketplace inventory…" : `${totalResults} vehicle${totalResults === 1 ? "" : "s"} found`}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4" /> {tripDays} day{tripDays === 1 ? "" : "s"} selected
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-white/70"><Filter className="h-4 w-4" /> Availability and price filters applied to results</div>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, item) => (
              <div key={item} className="h-[440px] animate-pulse rounded-[1.75rem] border border-white/15 bg-white/[.06]" />
            ))}
          </div>
        ) : cars.length === 0 && !error ? (
          <div className="rounded-[1.75rem] border border-white/20 bg-white/[.04] p-12 text-center">
            <Car className="mx-auto h-8 w-8 text-white/70" />
            <h2 className="mt-5 text-xl font-bold">No vehicles match this search.</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/70">Try a broader city search, a different date range, or remove one of the price or transmission filters.</p>
            <Button type="button" onClick={resetFilters} className="mt-6 bg-white text-black hover:bg-white/90">Reset filters</Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {cars.map((car) => (
              <Card key={car.id} className="group overflow-hidden rounded-[1.75rem] border-white/15 bg-[#111] p-0 text-white shadow-none transition hover:border-white/35">
                <Link href={detailHref(car.id)} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white">
                  <div className="relative h-60 overflow-hidden bg-white/[.06]">
                    <Image
                      src={car.mainImageUrl || "/images/car3.png"}
                      alt={car.name || "Vehicle"}
                      fill
                      unoptimized
                      className="object-cover transition duration-500 motion-safe:group-hover:scale-[1.03]"
                    />
                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                      {car.transmission ? <Badge className="border border-white/20 bg-black/75 text-white backdrop-blur">{car.transmission}</Badge> : null}
                      {car.seatCount ? <Badge className="border border-white/20 bg-black/75 text-white backdrop-blur"><Users className="mr-1 h-3 w-3" /> {car.seatCount}</Badge> : null}
                    </div>
                  </div>
                </Link>

                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-white/70">{car.location?.name || car.location?.city || query.city || "Marketplace listing"}</p>
                      <h2 className="mt-2 truncate text-2xl font-black tracking-tight">{car.name || "Elite Drive vehicle"}</h2>
                    </div>
                    {Number(car.averageRating || 0) > 0 ? (
                      <span className="flex shrink-0 items-center gap-1 text-sm font-bold" aria-label={`${Number(car.averageRating).toFixed(1)} out of 5 stars`}>
                        <Star className="h-4 w-4 fill-current" /> {Number(car.averageRating).toFixed(1)}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/15 pt-5">
                    <div>
                      <p className="text-xs font-medium text-white/70">Daily rate</p>
                      <p className="mt-1 text-xl font-black">{money(car.pricePerDay)} ₫</p>
                      <p className="mt-1 text-xs text-white/70">Est. {money((car.pricePerDay || 0) * tripDays)} ₫ for {tripDays} day{tripDays === 1 ? "" : "s"}</p>
                    </div>
                    <Button asChild className="rounded-full bg-white px-5 font-bold text-black hover:bg-white/90">
                      <Link href={detailHref(car.id)}>View details <ChevronRight className="ml-1 h-4 w-4" /></Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && meta && meta.lastPage > 1 ? (
          <nav className="mt-10 flex flex-wrap items-center justify-center gap-4" aria-label="Vehicle results pages">
            <Button type="button" variant="outline" onClick={() => void changePage(page - 1)} disabled={page <= 1 || loading} className="border-white/35 bg-transparent text-white hover:bg-white hover:text-black">
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <span className="min-w-28 text-center text-sm font-medium text-white/70">Page {page} of {meta.lastPage}</span>
            <Button type="button" variant="outline" onClick={() => void changePage(page + 1)} disabled={page >= meta.lastPage || loading} className="border-white/35 bg-transparent text-white hover:bg-white hover:text-black">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
