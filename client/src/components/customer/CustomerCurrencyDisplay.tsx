"use client";

import { useEffect, useRef } from "react";
import { formatUsdFromVnd, usdToVnd } from "@/lib/currency";

const VND_SUFFIX = /([0-9][0-9,.]*)\s*₫/g;
const VND_PREFIX = /₫\s*([0-9][0-9,.]*)/g;
const VND_CODE = /\bVND\s*([0-9][0-9,.]*)/gi;

function numericVnd(raw: string) {
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function usdEstimate(raw: string) {
  const value = numericVnd(raw);
  return value === null ? null : formatUsdFromVnd(value);
}

function convertMoneyText(value: string) {
  // Converted nodes retain the exact VND amount after the separator. React may
  // later replace the text node; in that case it becomes VND-only again and is
  // safely converted on the next mutation.
  if (value.includes(" · ") && value.includes("$")) return value;

  let next = value.replace(VND_SUFFIX, (match, amount: string) => {
    const usd = usdEstimate(amount);
    return usd ? `${usd} · ${match}` : match;
  });

  next = next.replace(VND_PREFIX, (match, amount: string) => {
    const usd = usdEstimate(amount);
    return usd ? `${usd} · ${match}` : match;
  });

  next = next.replace(VND_CODE, (match, amount: string) => {
    const usd = usdEstimate(amount);
    return usd ? `${usd} · ${match}` : match;
  });

  return next;
}

function relabelMarketplacePriceFilters(root: HTMLElement) {
  for (const element of root.querySelectorAll("span")) {
    const text = element.textContent?.trim();
    if (text === "Min price / day") element.textContent = "Min price / day (USD)";
    if (text === "Max price / day") element.textContent = "Max price / day (USD)";
  }
}

function convertTree(root: HTMLElement) {
  relabelMarketplacePriceFilters(root);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const parent = node.parentElement;
    if (
      parent &&
      !parent.closest("script, style, input, textarea, select, option, [data-vnd-only]")
    ) {
      const current = node.nodeValue ?? "";
      const converted = convertMoneyText(current);
      if (converted !== current) node.nodeValue = converted;
    }
    node = walker.nextNode();
  }
}

function convertMarketplaceFilterUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl, window.location.origin);
    if (url.pathname !== "/api/cars") return rawUrl;

    for (const key of ["minPrice", "maxPrice"] as const) {
      const rawValue = url.searchParams.get(key);
      if (!rawValue) continue;
      const converted = usdToVnd(rawValue);
      if (converted !== null) url.searchParams.set(key, String(converted));
    }

    if (/^https?:\/\//i.test(rawUrl)) return url.toString();
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return rawUrl;
  }
}

export function CustomerCurrencyDisplay({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    convertTree(root);
    const observer = new MutationObserver(() => convertTree(root));
    observer.observe(root, { childList: true, characterData: true, subtree: true });

    const originalFetch = window.fetch.bind(window);
    const patchedFetch: typeof window.fetch = (input, init) => {
      if (typeof input === "string") {
        return originalFetch(convertMarketplaceFilterUrl(input), init);
      }
      if (input instanceof URL) {
        return originalFetch(new URL(convertMarketplaceFilterUrl(input.toString())), init);
      }
      return originalFetch(input, init);
    };
    window.fetch = patchedFetch;

    return () => {
      observer.disconnect();
      if (window.fetch === patchedFetch) window.fetch = originalFetch;
    };
  }, []);

  return (
    <div ref={rootRef} className="contents" data-customer-currency="usd-estimate">
      {children}
    </div>
  );
}
