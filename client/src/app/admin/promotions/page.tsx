"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Power, RefreshCw, TicketPercent } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" });

type Promotion = {
  id: string; code: string; description?: string | null; discountType: string; discountValue: number;
  maxUses?: number | null; usedCount: number; minBookingAmount?: number | null; startDate: string; endDate: string; isActive: boolean;
};

type FormState = { code: string; description: string; discountType: "PERCENTAGE" | "FIXED"; discountValue: string; maxUses: string; minBookingAmount: string; startDate: string; endDate: string };

function defaults(): FormState {
  const start = new Date(); const end = new Date(); end.setDate(end.getDate() + 30);
  return { code: "", description: "", discountType: "PERCENTAGE", discountValue: "10", maxUses: "100", minBookingAmount: "", startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(defaults);

  const load = async () => {
    setLoading(true);
    try { const response: any = await api.get("/api/admin/promotions"); setPromotions(Array.isArray(response?.data) ? response.data : []); }
    catch (error: any) { toast.error(error?.response?.data?.message || error?.message || "Could not load promotions"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const active = promotions.filter((promotion) => promotion.isActive).length;
  const totalUses = useMemo(() => promotions.reduce((sum, promotion) => sum + Number(promotion.usedCount || 0), 0), [promotions]);

  const create = async () => {
    const value = Number(form.discountValue);
    if (!form.code.trim() || !Number.isFinite(value) || value <= 0 || !form.startDate || !form.endDate) { toast.error("Complete the required promotion fields"); return; }
    if (new Date(form.endDate) <= new Date(form.startDate)) { toast.error("End date must be after the start date"); return; }
    if (form.discountType === "PERCENTAGE" && value > 100) { toast.error("Percentage discounts cannot exceed 100%"); return; }
    setSaving(true);
    try {
      await api.post("/api/admin/promotions", {
        code: form.code.trim().toUpperCase(), description: form.description.trim() || undefined, discountType: form.discountType, discountValue: value,
        maxUses: form.maxUses ? Number(form.maxUses) : undefined, minBookingAmount: form.minBookingAmount ? Number(form.minBookingAmount) : undefined,
        startDate: new Date(`${form.startDate}T00:00:00.000Z`).toISOString(), endDate: new Date(`${form.endDate}T23:59:59.999Z`).toISOString(),
      });
      toast.success("Promotion created"); setOpen(false); setForm(defaults()); await load();
    } catch (error: any) { toast.error(error?.response?.data?.message || error?.message || "Could not create promotion"); }
    finally { setSaving(false); }
  };

  const toggle = async (promotion: Promotion) => {
    try { await api.patch(`/api/admin/promotions/${promotion.id}`, { isActive: !promotion.isActive }); toast.success(promotion.isActive ? "Promotion deactivated" : "Promotion activated"); await load(); }
    catch (error: any) { toast.error(error?.response?.data?.message || error?.message || "Could not update promotion"); }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Operations</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Promotions</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Create and activate marketplace discounts backed by the promotion API. Deactivation preserves historical usage rather than pretending to delete records.</p></div><div className="flex gap-2"><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus />New promotion</Button></DialogTrigger><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Create promotion</DialogTitle><DialogDescription>Define a percentage or fixed-value discount and its availability window.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><Field label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WEEKEND10" /></Field><Field label="Discount type"><Select value={form.discountType} onValueChange={(value: "PERCENTAGE" | "FIXED") => setForm({ ...form, discountType: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PERCENTAGE">Percentage</SelectItem><SelectItem value="FIXED">Fixed amount</SelectItem></SelectContent></Select></Field><Field label={form.discountType === "PERCENTAGE" ? "Discount (%)" : "Discount (VND)"}><Input type="number" min="1" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} /></Field><Field label="Usage limit"><Input type="number" min="1" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} placeholder="Unlimited when blank" /></Field><Field label="Minimum booking (VND)"><Input type="number" min="0" value={form.minBookingAmount} onChange={(e) => setForm({ ...form, minBookingAmount: e.target.value })} /></Field><div /><Field label="Start date"><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field><Field label="End date"><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field><div className="sm:col-span-2"><Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Weekend launch offer for eligible bookings." /></Field></div></div><DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus />}Create promotion</Button></DialogFooter></DialogContent></Dialog></div></div>
      <div className="grid gap-4 sm:grid-cols-3"><Metric label="Promotion records" value={String(promotions.length)} /><Metric label="Active promotions" value={String(active)} /><Metric label="Recorded uses" value={String(totalUses)} /></div>
      <Card><CardHeader><CardTitle className="text-lg">Promotion catalog</CardTitle><CardDescription>Usage counts and availability are read directly from persisted promotion records.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Discount</TableHead><TableHead>Eligibility</TableHead><TableHead>Window</TableHead><TableHead>Usage</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{loading ? Array.from({ length: 4 }).map((_, index) => <TableRow key={index}><TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell></TableRow>) : promotions.length === 0 ? <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No promotions have been created yet.</TableCell></TableRow> : promotions.map((promotion) => <TableRow key={promotion.id}><TableCell><div className="flex items-center gap-2 font-mono font-semibold"><TicketPercent className="h-4 w-4 text-muted-foreground" />{promotion.code}</div><div className="mt-1 max-w-56 text-xs text-muted-foreground">{promotion.description || "No description"}</div></TableCell><TableCell className="font-semibold">{promotion.discountType === "PERCENTAGE" ? `${promotion.discountValue}%` : currency.format(Number(promotion.discountValue || 0))}</TableCell><TableCell className="text-sm">{promotion.minBookingAmount ? `Min. ${currency.format(Number(promotion.minBookingAmount))}` : "No minimum"}</TableCell><TableCell className="text-sm text-muted-foreground">{dateFormatter.format(new Date(promotion.startDate))} — {dateFormatter.format(new Date(promotion.endDate))}</TableCell><TableCell>{promotion.usedCount} / {promotion.maxUses ?? "∞"}</TableCell><TableCell><Badge variant={promotion.isActive ? "outline" : "secondary"}>{promotion.isActive ? "Active" : "Inactive"}</Badge></TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => toggle(promotion)}><Power />{promotion.isActive ? "Deactivate" : "Activate"}</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Metric({ label, value }: { label: string; value: string }) { return <Card><CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-2xl">{value}</CardTitle></CardHeader></Card>; }
