const DEFAULT_VND_PER_USD = 25_000;

function configuredDisplayRate() {
  const configured = Number(process.env.NEXT_PUBLIC_VND_PER_USD);
  return Number.isFinite(configured) && configured >= 10_000 && configured <= 100_000
    ? configured
    : DEFAULT_VND_PER_USD;
}

export const VND_PER_USD = configuredDisplayRate();

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const vndFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function formatUsdFromVnd(value?: number | null) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return usdFormatter.format(amount / VND_PER_USD);
}

export function formatVnd(value?: number | null) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return vndFormatter.format(amount);
}

export function usdToVnd(value?: number | string | null) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * VND_PER_USD);
}
