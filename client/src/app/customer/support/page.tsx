"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, LifeBuoy, Loader2, MessageSquareWarning, RefreshCw, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Dispute = { id: string; title: string; description: string; status: string; bookingId?: string | null; createdAt: string };

export default function CustomerSupportPage() {
  const [history, setHistory] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [tab, setTab] = useState("new");
  const [type, setType] = useState("BOOKING_SUPPORT");
  const [bookingId, setBookingId] = useState("");
  const [description, setDescription] = useState("");

  const loadHistory = async () => {
    setHistoryLoading(true);
    try { const response: any = await api.get("/api/customer/disputes"); setHistory(Array.isArray(response?.data) ? response.data : []); }
    catch (error: any) { toast.error(error?.response?.data?.message || error?.message || "Could not load support history"); }
    finally { setHistoryLoading(false); }
  };
  useEffect(() => { void loadHistory(); }, []);

  const submit = async () => {
    if (description.trim().length < 10) return toast.error("Describe the issue in at least 10 characters");
    setLoading(true);
    try {
      await api.post("/api/customer/disputes", { type, bookingId: bookingId.trim() || undefined, description: description.trim(), title: `${labelFor(type)}${bookingId.trim() ? ` · ${bookingId.trim()}` : ""}` });
      toast.success("Support case submitted"); setDescription(""); setBookingId(""); await loadHistory(); setTab("history");
    } catch (error: any) { toast.error(error?.response?.data?.message || error?.message || "Could not submit support case"); }
    finally { setLoading(false); }
  };

  const activeCount = useMemo(() => history.filter((item) => ["OPEN", "IN_PROGRESS"].includes(item.status)).length, [history]);

  return <div className="mx-auto w-full max-w-5xl space-y-7 py-2"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Support</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Help center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Create a support or dispute case and follow its persisted operations status. This portfolio does not advertise a hotline or response-time SLA that the backend cannot verify.</p></div><div className="grid gap-4 sm:grid-cols-2"><Card><CardHeader className="flex-row items-center justify-between"><div><CardDescription>Support cases</CardDescription><CardTitle className="mt-2 text-2xl">{history.length}</CardTitle></div><LifeBuoy className="h-5 w-5 text-muted-foreground" /></CardHeader></Card><Card><CardHeader className="flex-row items-center justify-between"><div><CardDescription>Open / in progress</CardDescription><CardTitle className="mt-2 text-2xl">{activeCount}</CardTitle></div><MessageSquareWarning className="h-5 w-5 text-muted-foreground" /></CardHeader></Card></div><Tabs value={tab} onValueChange={setTab}><TabsList className="grid w-full max-w-md grid-cols-2"><TabsTrigger value="new">New case</TabsTrigger><TabsTrigger value="history">Case history</TabsTrigger></TabsList><TabsContent value="new" className="mt-5"><Card><CardHeader><CardTitle>Submit a support case</CardTitle><CardDescription>Link a booking when the issue is tied to a specific rental.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label>Case type</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BOOKING_SUPPORT">Booking support</SelectItem><SelectItem value="TRANSACTION_DISPUTE">Transaction dispute</SelectItem><SelectItem value="INCIDENT">Trip incident</SelectItem><SelectItem value="REFUND_REQUEST">Refund request</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="booking-id">Booking ID (optional)</Label><Input id="booking-id" value={bookingId} onChange={(e) => setBookingId(e.target.value)} placeholder="Booking identifier" /></div></div><div className="space-y-2"><Label htmlFor="support-description">What happened?</Label><Textarea id="support-description" className="min-h-40" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue, relevant dates, what you expected, and any action already taken..." /></div><Button onClick={submit} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <SendHorizontal />}Submit case</Button></CardContent></Card></TabsContent><TabsContent value="history" className="mt-5"><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Case history</CardTitle><CardDescription className="mt-1">Operations status for your submitted cases.</CardDescription></div><Button variant="outline" size="sm" onClick={loadHistory} disabled={historyLoading}><RefreshCw className={historyLoading ? "animate-spin" : ""} />Refresh</Button></CardHeader><CardContent>{historyLoading ? <div className="py-12 text-center text-sm text-muted-foreground">Loading support cases...</div> : history.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">You have not submitted a support case yet.</div> : <div className="space-y-3">{history.map((item) => <div key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><Status status={item.status} /><span className="font-mono text-xs text-muted-foreground">#{item.id.slice(-8).toUpperCase()}</span></div><h2 className="mt-3 font-semibold">{item.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p></div><span className="text-xs text-muted-foreground">{dateFormatter.format(new Date(item.createdAt))}</span></div></div>)}</div>}</CardContent></Card></TabsContent></Tabs></div>;
}

function labelFor(type: string) { return ({ BOOKING_SUPPORT: "Booking support", TRANSACTION_DISPUTE: "Transaction dispute", INCIDENT: "Trip incident", REFUND_REQUEST: "Refund request" } as Record<string, string>)[type] || "Support case"; }
function Status({ status }: { status: string }) { if (["RESOLVED", "CLOSED"].includes(status)) return <Badge variant="outline"><CheckCircle2 />{status === "RESOLVED" ? "Resolved" : "Closed"}</Badge>; if (status === "IN_PROGRESS") return <Badge variant="secondary"><Clock3 />In progress</Badge>; return <Badge variant="destructive"><MessageSquareWarning />Open</Badge>; }
