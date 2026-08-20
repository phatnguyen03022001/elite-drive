"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, Car, Check, CreditCard, KeyRound, Loader2, MapPin, Star, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useBookings, useCancelBooking, useCreateReview } from "@/features/customer/customer.queries";
import { notify, notifyError } from "@/lib/notifications";

type BookingStatus = "PENDING" | "APPROVED" | "REJECTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
type BookingRecord = {
  id: string; carId: string; startDate: string; endDate: string; pickupLocation?: string | null; totalPrice: number; status: BookingStatus;
  car?: { id?: string; name?: string; brand?: string; mainImageUrl?: string | null } | null;
};
type BookingListResponse = { data?: BookingRecord[]; items?: BookingRecord[] };

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" });
const statusLabel: Record<BookingStatus, string> = { PENDING: "Awaiting owner", APPROVED: "Ready for payment", REJECTED: "Declined", CONFIRMED: "Trip confirmed", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const lifecycle = [{ key: "request", label: "Requested" }, { key: "approval", label: "Owner approval" }, { key: "payment", label: "Payment" }, { key: "trip", label: "Trip" }, { key: "complete", label: "Complete" }] as const;

function progressFor(status: BookingStatus) { if (status === "PENDING") return 1; if (status === "APPROVED") return 2; if (status === "CONFIRMED") return 4; if (status === "COMPLETED") return 5; return 1; }
function statusVariant(status: BookingStatus): "default" | "secondary" | "destructive" | "outline" { if (status === "REJECTED" || status === "CANCELLED") return "destructive"; if (status === "CONFIRMED" || status === "COMPLETED") return "outline"; if (status === "APPROVED") return "default"; return "secondary"; }

function BookingLifecycle({ status }: { status: BookingStatus }) {
  const terminalFailure = status === "REJECTED" || status === "CANCELLED";
  const progress = progressFor(status);
  return <div className="mt-5 rounded-xl border bg-background/70 p-4"><div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Booking lifecycle</span>{terminalFailure ? <Badge variant="destructive">Flow stopped</Badge> : null}</div><div className="grid grid-cols-5 gap-1">{lifecycle.map((step, index) => { const reached = !terminalFailure && index < progress; const current = !terminalFailure && index === progress - 1 && status !== "COMPLETED"; return <div key={step.key} className="min-w-0 text-center"><div className="flex items-center"><div className={`h-px flex-1 ${index === 0 ? "bg-transparent" : reached ? "bg-foreground/50" : "bg-border"}`} /><div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${reached ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground"}`}>{reached && !current ? <Check className="h-3.5 w-3.5" /> : index + 1}</div><div className={`h-px flex-1 ${index === lifecycle.length - 1 ? "bg-transparent" : index + 1 < progress ? "bg-foreground/50" : "bg-border"}`} /></div><div className={`mt-2 truncate text-[10px] sm:text-xs ${current ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{step.label}</div></div>; })}</div></div>;
}

export default function MyBookingsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 0, content: "" });
  const bookingQuery = useBookings({ page: 1, limit: 50 });
  const cancelMutation = useCancelBooking();
  const reviewMutation = useCreateReview();

  const bookings = useMemo(() => {
    const result = bookingQuery.data as BookingRecord[] | BookingListResponse | undefined;
    return Array.isArray(result) ? result : result?.data ?? result?.items ?? [];
  }, [bookingQuery.data]);
  const filteredBookings = useMemo(() => activeTab === "active" ? bookings.filter((booking) => ["PENDING", "APPROVED", "CONFIRMED"].includes(booking.status)) : activeTab === "completed" ? bookings.filter((booking) => booking.status === "COMPLETED") : bookings, [activeTab, bookings]);

  const cancelBooking = async (bookingId: string) => {
    if (!window.confirm("Cancel this booking? Any eligible refund will be returned to your Elite Drive wallet.")) return;
    try { await cancelMutation.mutateAsync(bookingId); notify.success("Booking cancelled", { id: `customer-booking-${bookingId}`, description: "Any eligible refund will appear in Wallet & refunds after it is recorded." }); }
    catch (error: unknown) { notifyError("Booking could not be cancelled", error, "No booking state was changed. Refresh the page and try again.", { id: `customer-booking-${bookingId}` }); }
  };

  const openReview = (booking: BookingRecord) => { setSelectedBooking(booking); setReviewData({ rating: 0, content: "" }); setShowReviewDialog(true); };
  const submitReview = async () => {
    if (!selectedBooking) return;
    if (reviewData.rating < 1) { notify.warning("Choose a star rating", { id: "customer-review-validation", description: "Select a rating from one to five stars before submitting." }); return; }
    if (reviewData.content.trim().length < 10) { notify.warning("Add more trip detail", { id: "customer-review-validation", description: "Write at least 10 characters so the review is useful to other renters." }); return; }
    try {
      await reviewMutation.mutateAsync({ bookingId: selectedBooking.id, carId: selectedBooking.carId || selectedBooking.car?.id || "", rating: reviewData.rating, title: `Trip with ${selectedBooking.car?.name || "Elite Drive"}`, content: reviewData.content.trim() });
      notify.success("Review submitted", { id: `customer-review-${selectedBooking.id}`, description: "Your feedback is now attached to the completed trip." }); setShowReviewDialog(false);
    } catch (error: unknown) { notifyError("Review could not be submitted", error, "Your review was not saved. Check the content and try again.", { id: `customer-review-${selectedBooking.id}` }); }
  };

  return <div className="mx-auto w-full max-w-6xl space-y-8 py-2">
    <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Trips</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">My bookings</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Follow every rental from request and owner approval through payment, contract acknowledgment, handover, completion and review.</p></div>
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6"><TabsList className="grid w-full max-w-lg grid-cols-3"><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="active">Active</TabsTrigger><TabsTrigger value="completed">Completed</TabsTrigger></TabsList><TabsContent value={activeTab} className="space-y-4">
      {bookingQuery.isLoading ? Array.from({ length: 3 }).map((_, index) => <Card key={index}><CardContent className="flex gap-5 p-6"><Skeleton className="h-24 w-24 shrink-0 rounded-xl" /><div className="flex-1 space-y-3"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-20 w-full" /></div></CardContent></Card>) : bookingQuery.isError ? <Card className="border-destructive/30"><CardHeader><CardTitle>Bookings could not be loaded</CardTitle><CardDescription>No booking state was changed. Retry the request.</CardDescription></CardHeader><CardContent><Button onClick={() => bookingQuery.refetch()}>Try again</Button></CardContent></Card> : filteredBookings.length === 0 ? <Card><CardContent className="flex flex-col items-center py-16 text-center"><div className="rounded-2xl bg-muted p-4 text-muted-foreground"><Car className="h-7 w-7" /></div><h2 className="mt-5 text-lg font-semibold">No bookings here yet</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Find an available vehicle and choose your rental dates to start a booking.</p><Button asChild className="mt-5"><Link href="/customer/cars">Browse marketplace</Link></Button></CardContent></Card> : filteredBookings.map((booking) => <Card key={booking.id} className="overflow-hidden p-0"><div className="grid md:grid-cols-[1fr_260px]"><div className="p-5 sm:p-6"><div className="flex gap-5"><div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">{booking.car?.mainImageUrl ? <Image src={booking.car.mainImageUrl} alt={booking.car.name || "Rental vehicle"} fill className="object-cover" sizes="96px" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Car className="h-7 w-7" /></div>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant={statusVariant(booking.status)}>{statusLabel[booking.status]}</Badge><span className="font-mono text-xs text-muted-foreground">#{booking.id.slice(-8).toUpperCase()}</span></div><h2 className="mt-3 truncate text-lg font-semibold">{booking.car?.name || "Elite Drive vehicle"}</h2><div className="mt-3 space-y-2 text-sm text-muted-foreground"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{dateFormatter.format(new Date(booking.startDate))} — {dateFormatter.format(new Date(booking.endDate))}</div><div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{booking.pickupLocation || "Pickup location confirmed with owner"}</div></div></div></div><BookingLifecycle status={booking.status} /></div><div className="flex flex-col justify-between gap-5 border-t bg-muted/30 p-5 md:border-l md:border-t-0 sm:p-6"><div><div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Booking total</div><div className="mt-2 text-2xl font-bold">{currency.format(Number(booking.totalPrice || 0))}</div></div><div className="space-y-2">{booking.status === "APPROVED" ? <Button asChild className="w-full"><Link href={`/customer/payments/${booking.id}`}><CreditCard />Continue to payment</Link></Button> : null}{booking.status === "CONFIRMED" ? <Button asChild className="w-full"><Link href="/customer/trips"><KeyRound />Open trip & contract</Link></Button> : null}{["PENDING", "APPROVED", "CONFIRMED"].includes(booking.status) ? <Button variant="outline" className="w-full hover:border-destructive/30 hover:text-destructive" onClick={() => void cancelBooking(booking.id)} disabled={cancelMutation.isPending}><XCircle />Cancel booking</Button> : null}{booking.status === "COMPLETED" ? <Button variant="outline" className="w-full" onClick={() => openReview(booking)}><Star />Leave a review</Button> : null}{booking.status === "PENDING" ? <p className="text-center text-xs text-muted-foreground">Waiting for the vehicle owner to respond.</p> : null}{booking.status === "CANCELLED" ? <Button asChild variant="ghost" className="w-full"><Link href="/customer/wallet">View refund activity</Link></Button> : null}</div></div></div></Card>)}
    </TabsContent></Tabs>
    <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}><DialogContent><DialogHeader><DialogTitle>Review your trip</DialogTitle><DialogDescription>Share useful feedback about the vehicle and rental experience.</DialogDescription></DialogHeader><div className="space-y-4"><div className="flex gap-2" aria-label="Star rating">{[1,2,3,4,5].map((rating) => <Button key={rating} type="button" size="icon" variant={reviewData.rating >= rating ? "default" : "outline"} onClick={() => setReviewData((current) => ({ ...current, rating }))}><Star className={reviewData.rating >= rating ? "fill-current" : ""} /><span className="sr-only">{rating} stars</span></Button>)}</div><Textarea value={reviewData.content} onChange={(event) => setReviewData((current) => ({ ...current, content: event.target.value }))} placeholder="What should the next renter know?" rows={5} maxLength={1000} /></div><DialogFooter><Button variant="outline" onClick={() => setShowReviewDialog(false)} disabled={reviewMutation.isPending}>Cancel</Button><Button onClick={() => void submitReview()} disabled={reviewMutation.isPending}>{reviewMutation.isPending ? <Loader2 className="animate-spin" /> : <Star />}Submit review</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
