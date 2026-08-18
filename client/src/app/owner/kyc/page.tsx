"use client";

import Image from "next/image";
import { AlertCircle, CheckCircle2, Clock3, Eye, FileText, ShieldCheck } from "lucide-react";
import { useKycStatus } from "@/features/owner/owner.queries";
import { KycForm } from "@/features/owner/kyc/KycForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const statusConfig: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  APPROVED: { label: "Verified", icon: <CheckCircle2 className="h-3.5 w-3.5" />, variant: "outline" },
  PENDING: { label: "Under review", icon: <Clock3 className="h-3.5 w-3.5" />, variant: "secondary" },
  REJECTED: { label: "Action required", icon: <AlertCircle className="h-3.5 w-3.5" />, variant: "destructive" },
  NONE: { label: "Not submitted", icon: <ShieldCheck className="h-3.5 w-3.5" />, variant: "outline" },
};

export default function OwnerKycPage() {
  const { data: kyc, isLoading } = useKycStatus();

  if (isLoading) {
    return <div className="mx-auto max-w-5xl space-y-5 py-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-96 w-full rounded-xl" /></div>;
  }

  const status = kyc?.status ?? "NONE";
  const config = statusConfig[status] ?? statusConfig.NONE;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Trust & safety</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Identity verification</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Verify the owner identity behind a fleet before vehicles can progress through marketplace review.</p>
        </div>
        <Badge variant={config.variant} className="w-fit gap-2">{config.icon}{config.label}</Badge>
      </div>

      {status === "PENDING" || status === "APPROVED" ? (
        <Card>
          <CardHeader><CardTitle>Verification record</CardTitle><CardDescription>{status === "APPROVED" ? "Your owner identity has been approved." : "Your documents are waiting for operations review."}</CardDescription></CardHeader>
          <CardContent className="space-y-7">
            <div className="grid gap-4 sm:grid-cols-3">
              <Info label="Document type" value={kyc?.documentType || "—"} />
              <Info label="Document number" value={kyc?.documentNumber || "—"} />
              <Info label="Submitted" value={kyc?.submittedAt ? new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(kyc.submittedAt)) : "—"} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <DocumentPreview src={kyc?.documentFrontUrl} label="Document front" />
              <DocumentPreview src={kyc?.documentBackUrl} label="Document back" />
              <DocumentPreview src={kyc?.faceImageUrl} label="Face photo" />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {status === "REJECTED" ? (
        <>
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Verification needs attention</AlertTitle><AlertDescription>{kyc?.rejectionReason || "The submitted identity evidence could not be approved. Review the files and submit clearer evidence."}</AlertDescription></Alert>
          <Card><CardHeader><CardTitle>Submit updated evidence</CardTitle><CardDescription>Replace all three images so reviewers receive a complete new submission.</CardDescription></CardHeader><CardContent><KycForm defaultValues={kyc} /></CardContent></Card>
        </>
      ) : null}

      {status === "NONE" ? (
        <Card><CardHeader><CardTitle>Verify your identity</CardTitle><CardDescription>Provide an identity document and a clear face photo. All three images are required.</CardDescription></CardHeader><CardContent><KycForm /></CardContent></Card>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-muted/20 p-4"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-2 font-medium">{value}</div></div>;
}

function DocumentPreview({ src, label }: { src?: string; label: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><FileText className="h-3.5 w-3.5" />{label}</div>
      <button type="button" disabled={!src} onClick={() => src && window.open(src, "_blank", "noopener,noreferrer")} className="group relative aspect-[16/10] w-full overflow-hidden rounded-xl border bg-muted/30 text-muted-foreground disabled:cursor-default">
        {src ? <><Image src={src} alt={label} fill className="object-cover" unoptimized /><span className="absolute inset-0 flex items-center justify-center bg-background/70 opacity-0 transition-opacity group-hover:opacity-100"><span className="flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"><Eye className="h-4 w-4" />Open image</span></span></> : <span className="flex h-full items-center justify-center text-sm">No image</span>}
      </button>
    </div>
  );
}
