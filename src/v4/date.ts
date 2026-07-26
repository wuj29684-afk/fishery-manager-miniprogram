const pad = (value: number) => String(value).padStart(2, "0");

export function formatLocalDate(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addLocalDays(date: Date, days: number): string {
  return formatLocalDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}
