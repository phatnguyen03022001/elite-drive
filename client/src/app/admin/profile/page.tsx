"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, MapPin, Pencil, Phone, Save, ShieldCheck, Upload, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminProfile, useUpdateAdminProfile } from "@/features/admin/admin.queries";
import { notify, notifyError } from "@/lib/notifications";

type AdminProfile = {
  email?: string; firstName?: string | null; lastName?: string | null; phone?: string | null; avatar?: string | null; role?: string;
  profile?: { address?: string | null; city?: string | null; country?: string | null; postalCode?: string | null };
};

function profileToForm(profile: AdminProfile) {
  return {
    firstName: profile.firstName || "",
    lastName: profile.lastName || "",
    phone: profile.phone || "",
    address: profile.profile?.address || "",
    city: profile.profile?.city || "",
    country: profile.profile?.country || "Vietnam",
    postalCode: profile.profile?.postalCode || "",
  };
}

export default function AdminProfilePage() {
  const query = useAdminProfile();
  const update = useUpdateAdminProfile();
  const profile = query.data as AdminProfile | undefined;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", address: "", city: "", country: "Vietnam", postalCode: "" });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  const startEditing = () => {
    if (!profile) return;
    setForm(profileToForm(profile));
    setEditing(true);
  };

  const save = async () => {
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => { if (value.trim()) body.append(key, value.trim()); });
    if (avatar) body.append("avatar", avatar);
    try { await update.mutateAsync(body); notify.success("Admin profile updated", { id: "admin-profile" }); setEditing(false); setAvatar(null); setPreview(null); }
    catch (error: unknown) { notifyError("Admin profile could not be updated", error, "No profile change was assumed locally.", { id: "admin-profile" }); }
  };

  if (query.isLoading) return <Card className="flex min-h-80 items-center justify-center border-dashed"><Loader2 className="h-7 w-7 animate-spin" /></Card>;
  if (query.isError || !profile) return <Card className="border-destructive/30"><CardHeader><CardTitle>Profile could not be loaded</CardTitle><CardDescription>The admin profile API is unavailable.</CardDescription></CardHeader><CardContent><Button onClick={() => query.refetch()}>Try again</Button></CardContent></Card>;

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Administrator";
  const avatarSrc = preview || profile.avatar || undefined;
  return <div className="mx-auto max-w-4xl space-y-6"><Card><CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="flex items-center gap-2 text-2xl"><ShieldCheck className="h-6 w-6" />Admin profile</CardTitle><CardDescription className="mt-2">Account identity and contact details for the operations console.</CardDescription></div>{!editing ? <Button variant="outline" onClick={startEditing}><Pencil />Edit profile</Button> : null}</CardHeader><CardContent className="space-y-8">
    <div className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-center"><div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border bg-muted">{avatarSrc ? <img src={avatarSrc} alt={fullName} className="h-full w-full object-cover" /> : <User className="h-9 w-9 text-muted-foreground" />}</div><div className="flex-1"><h2 className="text-xl font-semibold">{fullName}</h2><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4" />{profile.email}</p>{editing ? <label className="mt-3 inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-medium"><Upload className="mr-2 h-4 w-4" />Choose avatar<input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setAvatar(file); setPreview(URL.createObjectURL(file)); }} /></label> : null}</div></div>
    {editing ? <div className="grid gap-4 sm:grid-cols-2"><Field label="First name" value={form.firstName} onChange={(value) => setForm({ ...form, firstName: value })} /><Field label="Last name" value={form.lastName} onChange={(value) => setForm({ ...form, lastName: value })} /><Field label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><Field label="City" value={form.city} onChange={(value) => setForm({ ...form, city: value })} /><Field label="Address" value={form.address} onChange={(value) => setForm({ ...form, address: value })} wide /><Field label="Country" value={form.country} onChange={(value) => setForm({ ...form, country: value })} /><Field label="Postal code" value={form.postalCode} onChange={(value) => setForm({ ...form, postalCode: value })} /><div className="flex gap-2 sm:col-span-2 sm:justify-end"><Button variant="ghost" onClick={() => setEditing(false)} disabled={update.isPending}>Cancel</Button><Button onClick={() => void save()} disabled={update.isPending}>{update.isPending ? <Loader2 className="animate-spin" /> : <Save />}Save changes</Button></div></div> : <div className="grid gap-3 sm:grid-cols-2"><Detail icon={Phone} label="Phone" value={profile.phone} /><Detail icon={MapPin} label="Address" value={[profile.profile?.address, profile.profile?.city, profile.profile?.country].filter(Boolean).join(", ")} /><Detail icon={User} label="Role" value={profile.role || "ADMIN"} /><Detail icon={Mail} label="Email" value={profile.email} /></div>}
  </CardContent></Card></div>;
}

function Field({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) { return <div className={wide ? "space-y-2 sm:col-span-2" : "space-y-2"}><Label>{label}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} maxLength={300} /></div>; }
function Detail({ icon: Icon, label, value }: { icon: typeof User; label: string; value?: string | null }) { return <div className="rounded-xl border p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><p className="mt-2 break-words text-sm font-medium">{value || "Not provided"}</p></div>; }
