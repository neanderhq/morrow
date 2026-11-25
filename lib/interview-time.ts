const minute = 60_000;
const day = 24 * 60 * minute;
const wallTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function canonicalTimeZone(value: unknown) {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_+/-]{0,79}$/i.test(value)) return null;
  try {
    return new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function zonedLocalTime(date: Date, timeZone: string) {
  const format = new Intl.DateTimeFormat("en", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const parts = Object.fromEntries(format.formatToParts(date).map(({ type, value }) => [type, value]));
  return parts.year + "-" + parts.month + "-" + parts.day + "T" + parts.hour + ":" + parts.minute;
}

export function resolveWallTime(value: unknown, timeZone: string): Date | null {
  if (typeof value !== "string" || !wallTimePattern.test(value)) return null;
  const wall = new Date(value + ":00.000Z");
  if (Number.isNaN(+wall) || wall.toISOString().slice(0, 16) !== value) return null;

  // Probe each side of a daylight-saving transition. Only a unique round-trip
  // to the exact wall time is accepted, including non-hour IANA offsets.
  const offsets = [-day, 0, day].map((delta) => {
    const probe = new Date(+wall + delta);
    return +new Date(zonedLocalTime(probe, timeZone) + ":00.000Z") - +probe;
  });
  const matches = [...new Set(offsets)].map((offset) => new Date(+wall - offset))
    .filter((instant) => zonedLocalTime(instant, timeZone) === value);
  return matches.length === 1 ? matches[0] : null;
}

export function displayInterviewTime(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
}
