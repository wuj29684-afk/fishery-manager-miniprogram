export function addDaysToDate(date: string, days: number): string {
  const parsed = Date.parse(date + "T00:00:00.000Z");
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed + Math.max(0, days) * 86400000).toISOString().slice(0, 10);
}

export function hasActiveWithdrawal(
  records: Array<{ type: string; date: string; withdrawalDays?: number; withdrawalEndDate?: string }>,
  date: string
): boolean {
  return records.some(
    (record) =>
      record.type === "drug" &&
      date >= record.date &&
      date <= (record.withdrawalEndDate || addDaysToDate(record.date, record.withdrawalDays || 0))
  );
}
