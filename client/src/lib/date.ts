const DAY_MS = 86_400_000;

export type TripDates = {
  startDate: string;
  endDate: string;
};

export function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function addDaysToDateInput(value: string, days = 1) {
  const date = parseDateInput(value);
  if (!date) return value;
  date.setDate(date.getDate() + days);
  return dateInputValue(date);
}

export function createDefaultTripDates(reference = new Date()): TripDates {
  const startDate = dateInputValue(reference);
  return { startDate, endDate: addDaysToDateInput(startDate, 1) };
}

export function normalizeTripDates(startDate: string, endDate: string): TripDates {
  if (!parseDateInput(startDate)) return createDefaultTripDates();
  if (!parseDateInput(endDate) || endDate <= startDate) {
    return { startDate, endDate: addDaysToDateInput(startDate, 1) };
  }
  return { startDate, endDate };
}

export function tripLengthDays(startDate: string, endDate: string) {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  if (!start || !end || end <= start) return 1;

  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(1, Math.round((endUtc - startUtc) / DAY_MS));
}
