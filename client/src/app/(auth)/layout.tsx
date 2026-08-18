import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Car } from "lucide-react";

export const metadata: Metadata = {
  title: "Account access",
  description: "Sign in, create an Elite Drive account, or recover account access.",
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4">
      <div className="absolute inset-0 -z-20"><Image src="/images/auth-bg.png" alt="" fill className="object-cover" priority /><div className="absolute inset-0 bg-black/65 backdrop-blur-sm" /></div>
      <Link href="/" className="fixed left-5 top-5 z-50 flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-2 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-black/50"><ArrowLeft className="h-4 w-4" />Back to marketplace</Link>
      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center text-white"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10"><Car className="h-5 w-5" /></div><h1 className="mt-4 text-3xl font-bold tracking-tight">Elite Drive</h1><p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Marketplace account</p></div>
        <main>{children}</main>
        <p className="text-center text-xs leading-5 text-white/55">Role-based access for renters, vehicle owners, and marketplace operations.</p>
      </div>
    </div>
  );
}
