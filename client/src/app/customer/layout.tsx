"use client";

import { useAuthContext } from "@/components/provider/AuthProvider";
import { CustomerCurrencyDisplay } from "@/components/customer/CustomerCurrencyDisplay";
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
import { AppSidebar } from "../../components/layout/AppSidebar";
import { AppHeader } from "../../components/layout/AppHeader";

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

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthContext();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isClient = useIsClient();

  const isPublicMarketplace =
    pathname === "/customer/cars" || pathname.startsWith("/customer/cars/");

  useEffect(() => {
    if (!isClient || isLoading || isPublicMarketplace) return;
    if (!user) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    if (user.role !== "CUSTOMER") {
      router.replace(ROLE_HOME[user.role ?? "CUSTOMER"]);
    }
  }, [isClient, isLoading, isPublicMarketplace, pathname, router, user]);

  if (isPublicMarketplace) {
    return <CustomerCurrencyDisplay>{children}</CustomerCurrencyDisplay>;
  }

  if (!isClient || isLoading || !user || user.role !== "CUSTOMER") {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <CustomerCurrencyDisplay>
      <div className="flex min-h-screen bg-background">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card md:flex">
          <AppSidebar role="CUSTOMER" />
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
                    <SheetTitle>Menu</SheetTitle>
                    <SheetDescription>Customer navigation menu</SheetDescription>
                  </SheetHeader>
                  <AppSidebar role="CUSTOMER" />
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
    </CustomerCurrencyDisplay>
  );
}
