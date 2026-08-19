"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Car, LogOut, Moon, Sun } from "lucide-react";
import { useAuthContext } from "@/components/provider/AuthProvider";
import { ROLE_NAV_CONFIG } from "@/enum/nav";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface AppSidebarProps {
  role: "ADMIN" | "OWNER" | "CUSTOMER";
}

const ROLE_LABELS = {
  ADMIN: "Operations console",
  OWNER: "Owner workspace",
  CUSTOMER: "Customer account",
} as const;

const PROFILE_ROUTES = {
  ADMIN: "/admin/reports",
  OWNER: "/owner/profile",
  CUSTOMER: "/customer/profile",
} as const;

export function AppSidebar({ role }: AppSidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, logout } = useAuthContext();
  const navGroups = ROLE_NAV_CONFIG[role] || [];
  const activeTheme = resolvedTheme ?? theme;
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Elite Drive user";
  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "ED";

  return (
    <div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-20 shrink-0 items-center border-b border-sidebar-border px-5">
        <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl shadow-sm",
              role === "ADMIN" ? "bg-destructive" : "bg-primary",
            )}>
            <Car size={21} className="text-primary-foreground" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold tracking-tight">Elite Drive</div>
            <div className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/65">
              {ROLE_LABELS[role]}
            </div>
          </div>
        </Link>
      </div>

      <ScrollArea className="flex-1 px-3 pb-4">
        <nav className="space-y-6 pt-4" aria-label={`${ROLE_LABELS[role]} navigation`}>
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/65">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-10 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                        isActive
                          ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "border-transparent text-sidebar-foreground/80 hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      )}>
                      {isActive ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-sidebar-primary" /> : null}
                      <item.icon className={cn("h-4.5 w-4.5 shrink-0", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/65")} />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="space-y-3 border-t border-sidebar-border p-4">
        <Button asChild variant="ghost" className="h-auto w-full justify-start gap-3 rounded-xl px-2 py-2 text-left">
          <Link href={PROFILE_ROUTES[role]}>
            <Avatar className="h-9 w-9 shrink-0 border border-sidebar-border">
              <AvatarImage src={user?.avatar ?? undefined} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{initials}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{displayName}</span>
              <span className="block truncate text-[11px] text-sidebar-foreground/65">{user?.email || "Account settings"}</span>
            </span>
          </Link>
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-transparent"
            onClick={() => setTheme(activeTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle color theme">
            {activeTheme === "dark" ? <Sun /> : <Moon />}
            {activeTheme === "dark" ? "Light" : "Dark"}
          </Button>
          <Button variant="outline" size="sm" className="bg-transparent hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive" onClick={logout}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
