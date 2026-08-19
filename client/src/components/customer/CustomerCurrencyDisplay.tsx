"use client";

import { useEffect, useRef } from "react";
import { formatUsdFromVnd } from "@/lib/currency";

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

function convertTree(root: HTMLElement) {
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

export function CustomerCurrencyDisplay({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    convertTree(root);
    const observer = new MutationObserver(() => convertTree(root));
    observer.observe(root, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="contents" data-customer-currency="usd-estimate">
      {children}
    </div>
  );
}
