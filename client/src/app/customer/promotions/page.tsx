"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Copy, RefreshCw, TicketPercent } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" });

type Promotion = { id: string; code: string; description?: string | null; discountType: string; discountValue: number; maxUses?: number | null; usedCount?: number; minBookingAmount?: number | null; startDate: string; endDate: string; isActive: boolean };

export default function CustomerPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const response: any = await api.get("/api/promotions", { params: { page: 1, limit: 50, isActive: true } });
      const records = response?.data?.data ?? response?.data ?? [];
      setPromotions(Array.isArray(records) ? records : []);
    } catch (error: any) { toast.error(error?.response?.data?.message || error?.message || "Could not load promotions"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const available = useMemo(() => promotions.filter((promotion) => promotion.isActive), [promotions]);
  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(code); toast.success("Promotion code copied"); window.setTimeout(() => setCopied(null), 1600);
  };

  return <div className="mx-auto w-full max-w-6xl space-y-7 py-2"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Savings</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Available promotions</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Active marketplace offers loaded directly from the promotion service. Apply an eligible code during booking checkout.</p></div><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button></div>{loading ? <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}</div> : available.length === 0 ? <Card className="border-dashed"><CardContent className="flex flex-col items-center py-16 text-center"><TicketPercent className="h-8 w-8 text-muted-foreground" /><h2 className="mt-4 font-semibold">No active promotions</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">New offers will appear here automatically when operations activates them.</p></CardContent></Card> : <div className="grid gap-4 md:grid-cols-2">{available.map((promotion) => <Card key={promotion.id} className="overflow-hidden"><CardHeader><div className="flex items-start justify-between gap-4"><div><Badge variant="secondary">Active offer</Badge><CardTitle className="mt-3 font-mono text-2xl tracking-tight">{promotion.code}</CardTitle><CardDescription className="mt-2 leading-6">{promotion.description || "Marketplace discount for eligible bookings."}</CardDescription></div><div className="rounded-xl bg-primary p-3 text-primary-foreground"><TicketPercent className="h-6 w-6" /></div></div></CardHeader><CardContent className="space-y-5"><div className="grid grid-cols-2 gap-3"><Info label="Discount" value={promotion.discountType === "PERCENTAGE" ? `${promotion.discountValue}%` : currency.format(Number(promotion.discountValue || 0))} /><Info label="Minimum booking" value={promotion.minBookingAmount ? currency.format(Number(promotion.minBookingAmount)) : "None"} /></div><div className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" />Valid through {dateFormatter.format(new Date(promotion.endDate))}</div><Button variant="outline" className="w-full" onClick={() => copyCode(promotion.code)}>{copied === promotion.code ? <Check /> : <Copy />}{copied === promotion.code ? "Copied" : "Copy promotion code"}</Button></CardContent></Card>)}</div>}</div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-muted/20 p-4"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-2 font-semibold">{value}</div></div>; }
