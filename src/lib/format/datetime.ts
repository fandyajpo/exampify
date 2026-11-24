const UTC_DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** Studio timestamps are shown in UTC, so two screens never disagree about a time. */
export function formatUtcDateTime(iso: string): string {
  return UTC_DATE_TIME.format(new Date(iso));
}
