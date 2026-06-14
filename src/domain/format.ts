export function formatMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}¥${Math.abs(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 0
  })}`;
}

export function formatArea(value: number): string {
  return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 1 })} 亩`;
}

export function todayString(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
