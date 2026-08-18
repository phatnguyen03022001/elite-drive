"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Building2, Landmark, Loader2, MapPin, Save, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useOwnerProfile, useUpdateOwnerProfile } from "@/features/owner/owner.queries";
import type { UpdateOwnerProfileInput } from "@/features/owner/owner.schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const emptyProfile: UpdateOwnerProfileInput = {
  companyName: "",
  taxId: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankCode: "",
  address: "",
  city: "",
  country: "Vietnam",
};

export default function OwnerProfilePage() {
  const profileQuery = useOwnerProfile();
  const updateProfile = useUpdateOwnerProfile();
  const { register, handleSubmit, reset, formState } = useForm<UpdateOwnerProfileInput>({ defaultValues: emptyProfile });

  useEffect(() => {
    if (!profileQuery.data) return;
    reset({
      companyName: profileQuery.data.companyName ?? "",
      taxId: profileQuery.data.taxId ?? "",
      bankAccountName: profileQuery.data.bankAccountName ?? "",
      bankAccountNumber: profileQuery.data.bankAccountNumber ?? "",
      bankCode: profileQuery.data.bankCode ?? "",
      address: profileQuery.data.address ?? "",
      city: profileQuery.data.city ?? "",
      country: profileQuery.data.country ?? "Vietnam",
    });
  }, [profileQuery.data, reset]);

  const saveProfile = (values: UpdateOwnerProfileInput) => {
    updateProfile.mutate(values, {
      onSuccess: () => toast.success("Owner profile updated"),
      onError: (error: any) => toast.error(error?.response?.data?.message || error?.message || "Could not update owner profile"),
    });
  };

  if (profileQuery.isLoading) {
    return <div className="mx-auto max-w-5xl space-y-5 py-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-40 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <Card className="mx-auto max-w-3xl border-destructive/30">
        <CardHeader><CardTitle>Owner profile is unavailable</CardTitle><CardDescription>The owner profile API could not be loaded. No account data was changed.</CardDescription></CardHeader>
        <CardContent><Button onClick={() => profileQuery.refetch()}>Try again</Button></CardContent>
      </Card>
    );
  }

  const profile = profileQuery.data;
  const displayName = [profile.user?.firstName, profile.user?.lastName].filter(Boolean).join(" ") || "Vehicle owner";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Account</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Owner profile</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Keep your business, payout, and operating address details current.</p>
        </div>
        <Badge variant="outline" className="w-fit gap-2"><ShieldCheck className="h-4 w-4" />{profile.verificationStatus || "UNVERIFIED"}</Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-muted p-2.5"><UserRound className="h-5 w-5" /></div>
            <div><CardTitle className="text-lg">Account identity</CardTitle><CardDescription className="mt-1">Identity fields come from the authenticated account and are read-only here.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <ReadOnlyField label="Name" value={displayName} />
          <ReadOnlyField label="Email" value={profile.user?.email || "—"} />
          <ReadOnlyField label="Phone" value={profile.user?.phone || "—"} />
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(saveProfile)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Building2 className="h-5 w-5" />Business details</CardTitle><CardDescription>Optional company and tax information associated with the owner account.</CardDescription></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Field label="Company name"><Input {...register("companyName")} placeholder="Elite Mobility Co." /></Field>
            <Field label="Tax ID"><Input {...register("taxId")} placeholder="Tax registration number" /></Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Landmark className="h-5 w-5" />Payout account</CardTitle><CardDescription>Banking metadata used by the withdrawal workflow. This does not initiate a transfer by itself.</CardDescription></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Field label="Account holder"><Input {...register("bankAccountName")} placeholder="NGUYEN VAN A" /></Field>
            <Field label="Account number"><Input {...register("bankAccountNumber")} placeholder="Bank account number" /></Field>
            <Field label="Bank code"><Input {...register("bankCode")} placeholder="VCB, TCB, ACB..." /></Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5" />Operating address</CardTitle><CardDescription>Primary address associated with fleet operations.</CardDescription></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Street address"><Input {...register("address")} placeholder="Street and district" /></Field></div>
            <Field label="City"><Input {...register("city")} placeholder="Ho Chi Minh City" /></Field>
            <Field label="Country"><Input {...register("country")} placeholder="Vietnam" /></Field>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={!formState.isDirty || updateProfile.isPending}>
            {updateProfile.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Save profile
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-muted/20 p-4"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-2 truncate font-medium">{value}</div></div>;
}
