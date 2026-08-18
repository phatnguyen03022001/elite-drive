"use client";

import { useState } from "react";
import { CalendarDays, Car, ChevronLeft, ChevronRight, MessageSquare, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CustomerService } from "@/features/customer/customer.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" });

type Review = {
  id: string;
  bookingId: string | null;
  carId: string;
  rating: number;
  title: string | null;
  content: string | null;
  createdAt: string;
  car: { name: string };
};

type ReviewResponse = {
  data: Review[];
  meta: { total: number; page: number; limit: number; lastPage: number };
};

export default function CustomerReviewsPage() {
  const [page, setPage] = useState(1);
  const query = useQuery<ReviewResponse>({
    queryKey: ["customer", "reviews", page],
    queryFn: async () => {
      const response = await CustomerService.getMyReviews({ page, limit: 6 });
      return response as ReviewResponse;
    },
    placeholderData: (previous) => previous,
  });
  const reviews = query.data?.data ?? [];
  const meta = query.data?.meta;
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 py-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Trips</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">My reviews</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Feedback you submitted after completed Elite Drive rentals.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardHeader><CardDescription>Total reviews</CardDescription><CardTitle className="text-3xl">{meta?.total ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Average on this page</CardDescription><CardTitle className="flex items-center gap-2 text-3xl">{average ? average.toFixed(1) : "—"}<Star className="h-5 w-5 fill-current" /></CardTitle></CardHeader></Card>
      </div>

      {query.isLoading && !query.data ? (
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-60 rounded-xl" />)}</div>
      ) : query.isError ? (
        <Card className="border-destructive/30"><CardHeader><CardTitle>Reviews are unavailable</CardTitle><CardDescription>The review API could not be loaded. Try again from the page refresh control.</CardDescription></CardHeader></Card>
      ) : reviews.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center py-16 text-center"><MessageSquare className="h-8 w-8 text-muted-foreground" /><h2 className="mt-4 font-semibold">No reviews yet</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">After a completed rental, you can leave feedback from My bookings.</p></CardContent></Card>
      ) : (
        <div className={`grid gap-4 md:grid-cols-2 ${query.isPlaceholderData ? "opacity-60" : ""}`}>
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2"><Car className="h-4 w-4 text-muted-foreground" /><CardTitle className="text-lg">{review.car?.name || "Rental vehicle"}</CardTitle></div>
                    <CardDescription className="mt-2 flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" />{dateFormatter.format(new Date(review.createdAt))}</CardDescription>
                  </div>
                  <Badge variant="outline">{review.rating}/5</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-1">{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-4 w-4 ${star <= review.rating ? "fill-current" : "text-muted-foreground/25"}`} />)}</div>
                <div>{review.title ? <h3 className="font-semibold">{review.title}</h3> : null}{review.content ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{review.content}</p> : null}</div>
                {review.bookingId ? <div className="border-t pt-3 font-mono text-[11px] text-muted-foreground">Booking #{review.bookingId.slice(-8).toUpperCase()}</div> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {meta && meta.lastPage > 1 ? (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" disabled={page <= 1 || query.isPlaceholderData} onClick={() => setPage((current) => current - 1)}><ChevronLeft />Previous</Button>
          <span className="text-sm text-muted-foreground">Page {meta.page} of {meta.lastPage}</span>
          <Button variant="outline" disabled={page >= meta.lastPage || query.isPlaceholderData} onClick={() => setPage((current) => current + 1)}>Next<ChevronRight /></Button>
        </div>
      ) : null}
    </div>
  );
}
