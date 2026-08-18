"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Car, CreditCard, Loader2, MapPin, Star, XCircle } from "lucide-react";
import { toast } from "sonner";
import { CustomerService } from "@/features/customer/customer.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const statusLabel: Record<string, string> = {
  PENDING: "Awaiting owner",
  APPROVED: "Ready for payment",
  REJECTED: "Declined",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (["REJECTED", "CANCELLED"].includes(status)) return "destructive";
  if (["CONFIRMED", "COMPLETED"].includes(status)) return "outline";
  if (status === "APPROVED") return "default";
  return "secondary";
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 0, content: "" });
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const result = await CustomerService.getBookings({ page: 1, limit: 50 });
      setBookings(Array.isArray(result) ? result : result?.data ?? []);
    } catch (error: any) {
      toast.error(error?.message || "Could not load your bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBookings();
  }, []);

  const filteredBookings = useMemo(() => {
    if (activeTab === "active") {
      return bookings.filter((booking) => ["PENDING", "APPROVED", "CONFIRMED"].includes(booking.status));
    }
    if (activeTab === "completed") return bookings.filter((booking) => booking.status === "COMPLETED");
    return bookings;
  }, [activeTab, bookings]);

  const cancelBooking = async (bookingId: string) => {
    if (!window.confirm("Cancel this booking? Any eligible refund will be returned to your Elite Drive wallet.")) return;
    try {
      await CustomerService.cancelBooking(bookingId);
      toast.success("Booking cancelled");
      await fetchBookings();
    } catch (error: any) {
      toast.error(error?.message || "Could not cancel this booking");
    }
  };

  const openReview = (booking: any) => {
    setSelectedBooking(booking);
    setReviewData({ rating: 0, content: "" });
    setShowReviewDialog(true);
  };

  const submitReview = async () => {
    if (!selectedBooking) return;
    if (reviewData.rating < 1) {
      toast.error("Choose a star rating");
      return;
    }
    if (reviewData.content.trim().length < 10) {
      toast.error("Write at least 10 characters about your trip");
      return;
    }

    setSubmittingReview(true);
    try {
      await CustomerService.createReview({
        bookingId: selectedBooking.id,
        carId: selectedBooking.carId || selectedBooking.car?.id,
        rating: reviewData.rating,
        title: `Trip with ${selectedBooking.car?.name || "Elite Drive"}`,
        content: reviewData.content.trim(),
      });
      toast.success("Review submitted");
      setShowReviewDialog(false);
      await fetchBookings();
    } catch (error: any) {
      toast.error(error?.message || "Could not submit your review");
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 py-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Trips</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">My bookings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Follow each rental from owner approval through payment, handover, completion, and review.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="flex gap-5 p-6">
                  <Skeleton className="h-24 w-24 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredBookings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16 text-center">
                <div className="rounded-2xl bg-muted p-4 text-muted-foreground">
                  <Car className="h-7 w-7" />
                </div>
                <h2 className="mt-5 text-lg font-semibold">No bookings here yet</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">Find an available vehicle and choose your rental dates to start a booking.</p>
                <Button asChild className="mt-5">
                  <Link href="/customer/cars">Browse vehicles</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredBookings.map((booking) => (
              <Card key={booking.id} className="overflow-hidden p-0">
                <div className="grid md:grid-cols-[1fr_260px]">
                  <div className="flex gap-5 p-5 sm:p-6">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                      {booking.car?.mainImageUrl ? (
                        <Image src={booking.car.mainImageUrl} alt={booking.car?.name || "Rental vehicle"} fill className="object-cover" sizes="96px" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Car className="h-7 w-7" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(booking.status)}>{statusLabel[booking.status] || booking.status}</Badge>
                        <span className="font-mono text-xs text-muted-foreground">#{booking.id?.slice(-8).toUpperCase()}</span>
                      </div>
                      <h2 className="mt-3 truncate text-lg font-semibold">{booking.car?.name || "Elite Drive vehicle"}</h2>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          {dateFormatter.format(new Date(booking.startDate))} — {dateFormatter.format(new Date(booking.endDate))}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {booking.pickupLocation || "Pickup location confirmed with owner"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-5 border-t bg-muted/30 p-5 md:border-l md:border-t-0 sm:p-6">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Booking total</div>
                      <div className="mt-2 text-2xl font-bold">{currency.format(Number(booking.totalPrice || 0))}</div>
                    </div>

                    <div className="space-y-2">
                      {booking.status === "APPROVED" ? (
                        <Button asChild className="w-full">
                          <Link href={`/customer/payments/${booking.id}`}>
                            <CreditCard />
                            Continue to payment
                          </Link>
                        </Button>
                      ) : null}

                      {["PENDING", "APPROVED"].includes(booking.status) ? (
                        <Button variant="outline" className="w-full hover:border-destructive/30 hover:text-destructive" onClick={() => cancelBooking(booking.id)}>
                          <XCircle />
                          Cancel booking
                        </Button>
                      ) : null}

                      {booking.status === "COMPLETED" ? (
                        <Button variant="outline" className="w-full" onClick={() => openReview(booking)}>
                          <Star />
                          Leave a review
                        </Button>
                      ) : null}

                      {booking.status === "PENDING" ? <p className="text-center text-xs text-muted-foreground">Waiting for the vehicle owner to respond.</p> : null}
                      {booking.status === "CONFIRMED" ? <p className="text-center text-xs font-medium">Payment recorded. Your trip is confirmed.</p> : null}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review your trip</DialogTitle>
            <DialogDescription>Share useful feedback about {selectedBooking?.car?.name || "this vehicle"}.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3">
            <div>
              <div className="mb-2 text-sm font-medium">Rating</div>
              <div className="flex gap-1" aria-label="Star rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewData((current) => ({ ...current, rating: star }))}
                    className="rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}>
                    <Star className={reviewData.rating >= star ? "fill-current" : "text-muted-foreground"} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="review-content" className="text-sm font-medium">Trip feedback</label>
              <Textarea
                id="review-content"
                placeholder="Vehicle condition, pickup experience, owner communication..."
                value={reviewData.content}
                onChange={(event) => setReviewData((current) => ({ ...current, content: event.target.value }))}
                className="min-h-28"
              />
              <p className="text-xs text-muted-foreground">Minimum 10 characters.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReviewDialog(false)}>Cancel</Button>
            <Button onClick={submitReview} disabled={submittingReview}>
              {submittingReview ? <Loader2 className="animate-spin" /> : <Star />}
              Submit review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
