const pad = (n) => String(n).padStart(2, "0");

// 오늘 날짜 (로컬 기준) 'YYYY-MM-DD'
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 'YYYY-MM'
export function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// 'YYYY-MM' -> { start: 'YYYY-MM-01', end: '다음달-01' }
export function monthRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const start = `${y}-${pad(m)}-01`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const end = `${ny}-${pad(nm)}-01`;
  return { start, end };
}

export function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export const won = (n) =>
  new Intl.NumberFormat("ko-KR").format(Math.round(Number(n) || 0)) + "원";

export const num = (n) =>
  new Intl.NumberFormat("ko-KR").format(Math.round(Number(n) || 0));

// 'YYYY-MM-DD' 하루 이동
export function shiftDay(dateStr, delta) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// 카드 정산 기준 금액: 정산액이 있으면 정산액, 없으면 결제금액(임시)
export const settledAmount = (r) =>
  r.payment_method === "card" && r.net_amount != null
    ? Number(r.net_amount)
    : Number(r.amount);
