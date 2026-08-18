import {
  Banknote,
  CalendarDays,
  Car,
  ClipboardCheck,
  CreditCard,
  DollarSign,
  Gavel,
  Headphones,
  History,
  Key,
  LayoutDashboard,
  ShieldCheck,
  Star,
  TicketPercent,
  UserCog,
  Vault,
  Wallet,
} from "lucide-react";

export const ROLE_NAV_CONFIG = {
  CUSTOMER: [
    { label: "Discover", items: [
      { title: "Find a car", href: "/customer/cars", icon: Car },
      { title: "Promotions", href: "/customer/promotions", icon: TicketPercent },
    ] },
    { label: "Trips", items: [{ title: "My bookings", href: "/customer/bookings", icon: History }] },
    { label: "Account", items: [
      { title: "Profile", href: "/customer/profile", icon: UserCog },
      { title: "Identity verification", href: "/customer/kyc", icon: ShieldCheck },
      { title: "Reviews", href: "/customer/reviews", icon: Star },
    ] },
    { label: "Support", items: [{ title: "Help center", href: "/customer/support", icon: Headphones }] },
  ],
  OWNER: [
    { label: "Overview", items: [{ title: "Dashboard", href: "/owner/dashboard", icon: LayoutDashboard }] },
    { label: "Fleet", items: [
      { title: "Vehicles", href: "/owner/cars", icon: Car },
      { title: "Availability & pricing", href: "/owner/calendar", icon: CalendarDays },
    ] },
    { label: "Operations", items: [
      { title: "Booking requests", href: "/owner/bookings", icon: History },
      { title: "Trip handover", href: "/owner/trips", icon: Key },
    ] },
    { label: "Finance", items: [{ title: "Wallet", href: "/owner/wallet", icon: Wallet }] },
    { label: "Account", items: [
      { title: "Owner profile", href: "/owner/profile", icon: UserCog },
      { title: "Identity verification", href: "/owner/kyc", icon: ShieldCheck },
    ] },
    { label: "Support", items: [{ title: "Help center", href: "/owner/support", icon: Headphones }] },
  ],
  ADMIN: [
    { label: "Trust & supply", items: [
      { title: "KYC reviews", href: "/admin/kyc", icon: ShieldCheck },
      { title: "Vehicle approvals", href: "/admin/cars", icon: ClipboardCheck },
    ] },
    { label: "Finance", items: [
      { title: "Platform finance", href: "/admin/escrow", icon: Vault },
      { title: "Payment ledger", href: "/admin/reports", icon: CreditCard },
      { title: "Settlements", href: "/admin/settlements", icon: DollarSign },
      { title: "Withdrawals", href: "/admin/withdraws", icon: Banknote },
    ] },
    { label: "Operations", items: [
      { title: "Disputes", href: "/admin/disputes", icon: Gavel },
      { title: "Promotions", href: "/admin/promotions", icon: TicketPercent },
    ] },
  ],
} as const;
