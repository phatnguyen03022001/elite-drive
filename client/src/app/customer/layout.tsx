"use client";

import { useAuthContext } from "@/components/provider/AuthProvider";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Loader2, Menu } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
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

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthContext();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isClient = useIsClient();

  // Vehicle discovery is intentionally public. The listing and detail pages own
  // their marketplace chrome and only require authentication when a renter
  // creates a booking request.
  const isPublicMarketplace = pathname === "/customer/cars" || pathname.startsWith("/customer/cars/");
  if (isPublicMarketplace) return <>{children}</>;

  if (!isClient || isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "CUSTOMER") return null;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r bg-card sticky top-0 h-screen shrink-0">
        <AppSidebar role="CUSTOMER" />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center pr-4">
          <div className="md:hidden pl-4">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
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

        <main className="p-4 md:p-6 flex-1 bg-background">{children}</main>
      </div>
    </div>
  );
}
