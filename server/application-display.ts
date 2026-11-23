import { isApplicationStage } from "./policy.ts";

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatStableDateTime(value: Date | string) {
  return `${dateTimeFormat.format(value instanceof Date ? value : new Date(value))} UTC`;
}

export function applicationStageBadgeLabel(stage: string) {
  return isApplicationStage(stage) ? stage : null;
}
