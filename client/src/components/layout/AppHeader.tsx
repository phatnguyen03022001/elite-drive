"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";

const ROLE_LABELS: Record<string, string> = {
  customer: "Customer",
  owner: "Owner",
  admin: "Admin",
};

function formatSegment(segment: string) {
  return ROLE_LABELS[segment] ?? segment.replaceAll("-", " ");
}

export function AppHeader() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const segments = pathname.split("/").filter(Boolean);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries();
      toast.success("Data is up to date");
    } catch {
      toast.error("Could not refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/" className="font-semibold transition-colors hover:text-foreground">
              Elite Drive
            </BreadcrumbLink>
          </BreadcrumbItem>
          {segments.map((segment, index) => {
            const isLast = index === segments.length - 1;
            const href = `/${segments.slice(0, index + 1).join("/")}`;
            return (
              <React.Fragment key={`${segment}-${index}`}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="capitalize font-medium">{formatSegment(segment)}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={href} className="capitalize text-muted-foreground transition-colors hover:text-foreground">
                      {formatSegment(segment)}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} aria-label="Refresh page data">
        <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
        <span className="hidden sm:inline">{isRefreshing ? "Refreshing" : "Refresh"}</span>
      </Button>
    </header>
  );
}
