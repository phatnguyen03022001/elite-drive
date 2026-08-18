"use client";

import { toast } from "sonner";

type NotificationOptions = {
  description?: string;
  duration?: number;
  id?: string | number;
};

const DURATIONS = {
  success: 4_500,
  info: 5_000,
  warning: 6_500,
  error: 8_000,
} as const;

function compactMessage(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 220) return normalized;
  return `${normalized.slice(0, 217).trimEnd()}…`;
}

function messageCandidate(error: unknown): unknown {
  if (!error || typeof error !== "object") return error;

  const candidate = error as {
    message?: unknown;
    response?: { status?: number; data?: { message?: unknown } };
  };

  return candidate.response?.data?.message ?? candidate.message;
}

export function getErrorMessage(error: unknown, fallback: string) {
  const status =
    error && typeof error === "object"
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;

  if (status === 401) return "Your session has expired. Sign in again to continue.";
  if (status === 403) return "This account is not allowed to complete that action.";
  if (status && status >= 500) return fallback;

  const candidate = messageCandidate(error);

  if (Array.isArray(candidate)) {
    const joined = candidate
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map(compactMessage)
      .join(" ");
    return joined || fallback;
  }

  if (typeof candidate === "string" && candidate.trim()) {
    if (/network error|failed to fetch|network request failed/i.test(candidate)) {
      return "The service could not be reached. Check your connection and try again.";
    }
    return compactMessage(candidate);
  }

  return fallback;
}

function withDuration(options: NotificationOptions, duration: number) {
  return { duration, ...options };
}

export const notify = {
  success(title: string, options: NotificationOptions = {}) {
    return toast.success(title, withDuration(options, DURATIONS.success));
  },
  info(title: string, options: NotificationOptions = {}) {
    return toast.info(title, withDuration(options, DURATIONS.info));
  },
  warning(title: string, options: NotificationOptions = {}) {
    return toast.warning(title, withDuration(options, DURATIONS.warning));
  },
  error(title: string, options: NotificationOptions = {}) {
    return toast.error(title, withDuration(options, DURATIONS.error));
  },
};

export function notifyError(
  title: string,
  error: unknown,
  fallback: string,
  options: NotificationOptions = {},
) {
  return notify.error(title, {
    ...options,
    description: options.description ?? getErrorMessage(error, fallback),
  });
}
