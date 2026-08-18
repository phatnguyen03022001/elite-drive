"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Hash,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
  User,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useProfile, useUpdateProfile } from "@/features/customer/customer.queries";
import {
  UpdateCustomerProfileInput,
  UpdateCustomerProfileSchema,
} from "@/features/customer/customer.schema";

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-semibold">{value || "Not provided"}</p>
    </div>
  );
}

function kycLabel(status?: string) {
  if (status === "APPROVED") return "Verified";
  if (status === "PENDING") return "Under review";
  if (status === "REJECTED") return "Action required";
  return "Not submitted";
}

export default function CustomerProfilePage() {
  const [editing, setEditing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const form = useForm<UpdateCustomerProfileInput>({
    resolver: zodResolver(UpdateCustomerProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      avatar: "",
      address: "",
      city: "",
      country: "Vietnam",
      postalCode: "",
      dateOfBirth: "",
    },
  });

  useEffect(() => {
    if (!profile) return;
    form.reset({
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      phone: profile.phone || "",
      avatar: profile.avatar || "",
      address: profile.profile?.address || "",
      city: profile.profile?.city || "",
      country: profile.profile?.country || "Vietnam",
      postalCode: profile.profile?.postalCode || "",
      dateOfBirth: profile.profile?.dateOfBirth
        ? new Date(profile.profile.dateOfBirth).toISOString().split("T")[0]
        : "",
    });
  }, [form, profile]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const submit = (values: UpdateCustomerProfileInput) => {
    const body = new FormData();

    Object.entries(values).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (key === "avatar") {
        if (value instanceof File) body.append("avatar", value);
        return;
      }
      body.append(key, value instanceof Date ? value.toISOString() : String(value));
    });

    updateProfile.mutate(body as any, {
      onSuccess: () => {
        toast.success("Profile updated.");
        setEditing(false);
        setPreviewUrl(null);
      },
      onError: (error: any) => {
        const message = error?.response?.data?.message;
        toast.error(typeof message === "string" ? message : "Unable to update your profile.");
      },
    });
  };

  const cancel = () => {
    if (profile) {
      form.reset({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        phone: profile.phone || "",
        avatar: profile.avatar || "",
        address: profile.profile?.address || "",
        city: profile.profile?.city || "",
        country: profile.profile?.country || "Vietnam",
        postalCode: profile.profile?.postalCode || "",
        dateOfBirth: profile.profile?.dateOfBirth
          ? new Date(profile.profile.dateOfBirth).toISOString().split("T")[0]
          : "",
      });
    }
    setEditing(false);
    setPreviewUrl(null);
  };

  if (isLoading) {
    return (
      <Card className="flex min-h-[320px] items-center justify-center border-dashed">
        <div className="text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin" />
          <p className="mt-3 text-sm text-muted-foreground">Loading your profile…</p>
        </div>
      </Card>
    );
  }

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Elite Drive member";
  const kycStatus = profile?.kycStatus || "NONE";
  const approved = kycStatus === "APPROVED";
  const avatarSrc = previewUrl || profile?.avatar || null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <User className="h-6 w-6" />
              Renter profile
            </CardTitle>
            <CardDescription className="mt-2 max-w-2xl">
              Keep your contact and residency details current for bookings and account verification.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
                approved
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              }`}
            >
              {approved ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              KYC · {kycLabel(kycStatus)}
            </div>
            {!editing && (
              <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit profile
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="space-y-8">
              <section className="flex flex-col items-center gap-4 border-b pb-8 text-center">
                <div className="relative h-28 w-28 overflow-hidden rounded-full border bg-muted shadow-sm">
                  {avatarSrc ? (
                    // Blob previews and remote account images are intentionally rendered without optimization.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarSrc} alt={`${fullName} profile`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <User className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-bold">{fullName}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{profile?.email}</p>
                </div>

                {editing && (
                  <label className="inline-flex cursor-pointer items-center rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
                    <Upload className="mr-2 h-4 w-4" />
                    Choose profile image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        form.setValue("avatar", file, { shouldDirty: true });
                        setPreviewUrl(URL.createObjectURL(file));
                      }}
                    />
                  </label>
                )}
              </section>

              <section className="grid gap-6 lg:grid-cols-[240px_1fr]">
                <div>
                  <h3 className="font-semibold">Personal details</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Core identity and contact information used by your account.
                  </p>
                </div>

                {editing ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormItem className="md:col-span-2">
                      <FormLabel>Email</FormLabel>
                      <Input value={profile?.email || ""} disabled />
                    </FormItem>
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First name</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last name</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of birth</FormLabel>
                          <FormControl><Input type="date" {...field} value={typeof field.value === "string" ? field.value : ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl><Input inputMode="tel" placeholder="0901234567" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Detail icon={Mail} label="Email" value={profile?.email} />
                    <Detail icon={Phone} label="Phone" value={profile?.phone} />
                    <Detail icon={User} label="Name" value={fullName} />
                    <Detail
                      icon={CalendarDays}
                      label="Date of birth"
                      value={profile?.profile?.dateOfBirth ? new Date(profile.profile.dateOfBirth).toLocaleDateString("en-US") : null}
                    />
                  </div>
                )}
              </section>

              <section className="grid gap-6 border-t pt-8 lg:grid-cols-[240px_1fr]">
                <div>
                  <h3 className="font-semibold">Address</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Residency details associated with your renter account.
                  </p>
                </div>

                {editing ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Street address</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal code</FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Detail icon={MapPin} label="Street address" value={profile?.profile?.address} />
                    <Detail icon={MapPin} label="City" value={profile?.profile?.city} />
                    <Detail icon={MapPin} label="Country" value={profile?.profile?.country} />
                    <Detail icon={Hash} label="Postal code" value={profile?.profile?.postalCode} />
                  </div>
                )}
              </section>

              <section className="rounded-xl border bg-muted/30 p-4">
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Identity verification</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      KYC documents are managed separately from profile contact details. Use the Identity verification page to submit or review your verification status.
                    </p>
                  </div>
                </div>
              </section>

              {editing && (
                <div className="flex flex-wrap justify-end gap-3 border-t pt-6">
                  <Button type="button" variant="ghost" onClick={cancel} disabled={updateProfile.isPending}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!form.formState.isDirty || updateProfile.isPending}>
                    {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save changes
                  </Button>
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
