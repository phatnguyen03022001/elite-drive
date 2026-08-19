"use client";

import { useAuthContext } from "@/components/provider/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Loader2, Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";

const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

const ROLE_HOME = {
  ADMIN: "/admin",
  OWNER: "/owner/dashboard",
  CUSTOMER: "/customer/bookings",
} as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthContext();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isClient = useIsClient();

  useEffect(() => {
    if (!isClient || isLoading) return;
    if (!user) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    if (user.role !== "ADMIN") {
      router.replace(ROLE_HOME[user.role ?? "CUSTOMER"]);
    }
  }, [isClient, isLoading, pathname, router, user]);

  if (!isClient || isLoading || !user || user.role !== "ADMIN") {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card md:flex">
        <AppSidebar role="ADMIN" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center pr-4">
          <div className="pl-4 md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Admin menu</SheetTitle>
                  <SheetDescription>Administration navigation menu</SheetDescription>
                </SheetHeader>
                <AppSidebar role="ADMIN" />
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex-1">
            <AppHeader />
          </div>
        </div>

        <main className="flex-1 bg-background p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
