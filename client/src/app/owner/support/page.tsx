"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, LifeBuoy, Loader2, MessageSquare, RefreshCw, SendHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { OwnerService } from "@/features/owner/owner.service";
import { notify, notifyError } from "@/lib/notifications";

type Message = { id: string; senderId: string; message: string; createdAt: string };
type Dispute = {
  id: string;
  title: string;
  description?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  bookingId?: string | null;
  createdAt: string;
  initiator?: { role?: string; firstName?: string | null; lastName?: string | null; email?: string };
  booking?: { car?: { name?: string; licensePlate?: string } } | null;
  disputeMessages?: Message[];
};

const dateTime = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function OwnerSupportPage() {
  const [cases, setCases] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [tab, setTab] = useState("cases");
  const [type, setType] = useState("BOOKING_SUPPORT");
  const [bookingId, setBookingId] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const result = await OwnerService.getDisputes();
      setCases(Array.isArray(result) ? result : []);
    } catch (error: unknown) {
      notifyError("Owner support queue unavailable", error, "Cases could not be loaded. No support state was changed.", { id: "owner-support-load" });
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const activeCount = useMemo(() => cases.filter((item) => ["OPEN", "IN_PROGRESS"].includes(item.status)).length, [cases]);
  const create = async () => {
    if (description.trim().length < 10) { notify.warning("Add more detail", { id: "owner-support-validation", description: "Describe the issue in at least 10 characters." }); return; }
    setSubmitting(true);
    try {
      await OwnerService.createDispute({ type, bookingId: bookingId.trim() || undefined, title: bookingId.trim() ? `Owner support · ${bookingId.trim()}` : "Owner account support", description: description.trim() });
      notify.success("Support case submitted", { id: "owner-support-submit", description: "The case is stored in the same operations queue used by admin dispute review." });
      setBookingId(""); setDescription(""); await load(); setTab("cases");
    } catch (error: unknown) { notifyError("Support case could not be submitted", error, "No case was created.", { id: "owner-support-submit" }); }
    finally { setSubmitting(false); }
  };

  const respond = async (caseId: string) => {
    if (responseText.trim().length < 3) return;
    setRespondingId(caseId);
    try {
      await OwnerService.respondDispute(caseId, responseText.trim());
      notify.success("Response added", { id: `owner-support-${caseId}` });
      setResponseText(""); await load();
    } catch (error: unknown) { notifyError("Response could not be added", error, "The case was not changed.", { id: `owner-support-${caseId}` }); }
    finally { setRespondingId(null); }
  };

  return <div className="mx-auto w-full max-w-5xl space-y-7 py-2">
    <div><div className="flex items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Support</p><Badge variant={activeCount ? "destructive" : "secondary"}>{activeCount} active</Badge></div><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Owner help center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Create a persisted support case or respond to a renter dispute connected to one of your vehicles. This flow uses only the local application database; no paid support service is required.</p></div>
    <Tabs value={tab} onValueChange={setTab}><TabsList className="grid w-full max-w-md grid-cols-2"><TabsTrigger value="cases">Case queue</TabsTrigger><TabsTrigger value="new">New case</TabsTrigger></TabsList>
      <TabsContent value="cases" className="mt-6"><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-lg">Visible support cases</CardTitle><CardDescription>Includes cases you opened and renter disputes tied to vehicles you own.</CardDescription></div><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button></CardHeader><CardContent>{loading ? <div className="flex justify-center py-14"><Loader2 className="h-7 w-7 animate-spin" /></div> : cases.length === 0 ? <div className="py-14 text-center"><LifeBuoy className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-4 font-semibold">No support cases</h2><p className="mt-2 text-sm text-muted-foreground">New owner cases and renter disputes will appear here.</p></div> : <div className="space-y-4">{cases.map((item) => <div key={item.id} className="rounded-xl border p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><Status status={item.status} /><span className="font-mono text-xs text-muted-foreground">#{item.id.slice(-8).toUpperCase()}</span>{item.booking?.car?.name ? <span className="text-xs text-muted-foreground">{item.booking.car.name} · {item.booking.car.licensePlate}</span> : null}</div><h2 className="mt-3 font-semibold">{item.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description || "No description"}</p><p className="mt-3 text-xs text-muted-foreground">Opened {dateTime.format(new Date(item.createdAt))} by {[item.initiator?.firstName, item.initiator?.lastName].filter(Boolean).join(" ") || item.initiator?.email || item.initiator?.role || "user"}</p></div></div>{item.disputeMessages?.length ? <div className="mt-4 space-y-2 border-t pt-4">{item.disputeMessages.map((message) => <div key={message.id} className="rounded-lg bg-muted/40 p-3"><p className="text-sm">{message.message}</p><p className="mt-1 text-[11px] text-muted-foreground">{dateTime.format(new Date(message.createdAt))}</p></div>)}</div> : null}{["OPEN", "IN_PROGRESS"].includes(item.status) ? <div className="mt-4 flex gap-2 border-t pt-4"><Textarea value={respondingId === item.id ? responseText : ""} onFocus={() => { if (respondingId !== item.id) { setRespondingId(item.id); setResponseText(""); } }} onChange={(event) => { setRespondingId(item.id); setResponseText(event.target.value); }} placeholder="Add a factual response for operations review..." maxLength={4000} /><Button onClick={() => void respond(item.id)} disabled={respondingId === item.id && submitting}><SendHorizontal />Reply</Button></div> : null}</div>)}</div>}</CardContent></Card></TabsContent>
      <TabsContent value="new" className="mt-6"><Card><CardHeader><CardTitle className="text-lg">Create owner support case</CardTitle><CardDescription>Booking ID is optional. If supplied, the backend verifies that the booking belongs to a vehicle you own.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Issue type</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BOOKING_SUPPORT">Booking support</SelectItem><SelectItem value="VEHICLE_SUPPORT">Vehicle support</SelectItem><SelectItem value="PAYOUT_SUPPORT">Payout support</SelectItem><SelectItem value="ACCOUNT_SUPPORT">Account support</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Booking ID (optional)</Label><Input value={bookingId} onChange={(event) => setBookingId(event.target.value)} placeholder="Booking ObjectId" maxLength={64} /></div></div><div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the issue, expected outcome, and relevant facts..." className="min-h-36" maxLength={4000} /></div><Button onClick={() => void create()} disabled={submitting}>{submitting ? <Loader2 className="animate-spin" /> : <MessageSquare />}Submit case</Button></CardContent></Card></TabsContent>
    </Tabs>
  </div>;
}

function Status({ status }: { status: string }) { if (status === "RESOLVED" || status === "CLOSED") return <Badge variant="outline"><CheckCircle2 />{status}</Badge>; if (status === "IN_PROGRESS") return <Badge variant="secondary"><Clock3 />In progress</Badge>; return <Badge variant="destructive">Open</Badge>; }
