"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, ShieldCheck, UserCog, UserX } from "lucide-react";
import { AdminService } from "@/features/admin/admin.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notify, notifyError } from "@/lib/notifications";

type UserRecord = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  role: string;
  isActive: boolean;
  verificationStatus?: string;
  createdAt: string;
};

type UserPage = { items?: UserRecord[]; data?: UserRecord[]; total?: number; page?: number; limit?: number };
const createdAtFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" });

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await AdminService.getUsers({ page: 1, limit: 50 }) as UserPage;
      const items = result.items ?? result.data ?? [];
      setUsers(items);
      setTotal(Number(result.total ?? items.length));
    } catch (error: unknown) {
      notifyError("Accounts could not be loaded", error, "No account state was changed. Try refreshing the list.", { id: "admin-users-load" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => `${user.email} ${user.firstName || ""} ${user.lastName || ""} ${user.role}`.toLowerCase().includes(needle));
  }, [search, users]);

  const inactiveCount = useMemo(() => users.filter((user) => !user.isActive).length, [users]);

  const toggleStatus = async (user: UserRecord) => {
    const nextStatus = user.isActive ? "INACTIVE" : "ACTIVE";
    const action = user.isActive ? "deactivate" : "reactivate";
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} ${user.email}? Existing sessions will be rejected by live account validation.`)) return;
    setUpdatingId(user.id);
    try {
      await AdminService.updateUserStatus(user.id, nextStatus);
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, isActive: !user.isActive } : item));
      notify.success(`Account ${nextStatus === "ACTIVE" ? "reactivated" : "deactivated"}`, { id: `admin-user-${user.id}`, description: "Authorization checks will use the updated account state." });
    } catch (error: unknown) {
      notifyError("Account status could not be changed", error, "No account state was changed. Refresh and try again.", { id: `admin-user-${user.id}` });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Access control</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Accounts</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Inspect marketplace accounts and deactivate access without deleting business history or financial records.</p></div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Accounts" value={total} icon={<UserCog />} />
        <Metric label="Visible records" value={users.length} icon={<ShieldCheck />} />
        <Metric label="Inactive on page" value={inactiveCount} icon={<UserX />} />
      </div>

      <Card>
        <CardHeader className="gap-4"><div><CardTitle className="text-lg">Account directory</CardTitle><CardDescription>Deactivation preserves historical records while live JWT validation blocks future protected requests.</CardDescription></div><div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" aria-label="Search accounts" placeholder="Search email, name or role..." value={search} onChange={(event) => setSearch(event.target.value)} /></div></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Role</TableHead><TableHead>Verification</TableHead><TableHead>Created</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }).map((_, index) => <TableRow key={index}><TableCell colSpan={6}><Skeleton className="h-11 w-full" /></TableCell></TableRow>) : visible.length === 0 ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No accounts match this search.</TableCell></TableRow> : visible.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell><div className="font-medium">{[user.firstName, user.lastName].filter(Boolean).join(" ") || "Account holder"}</div><div className="text-xs text-muted-foreground">{user.email}</div></TableCell>
                    <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{user.verificationStatus || "UNKNOWN"}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{createdAtFormatter.format(new Date(user.createdAt))}</TableCell>
                    <TableCell>{user.isActive ? <Badge variant="outline">Active</Badge> : <Badge variant="destructive">Inactive</Badge>}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant={user.isActive ? "outline" : "default"} disabled={updatingId === user.id} onClick={() => void toggleStatus(user)}>{user.isActive ? "Deactivate" : "Reactivate"}</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardDescription>{label}</CardDescription><div className="text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</div></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>;
}
