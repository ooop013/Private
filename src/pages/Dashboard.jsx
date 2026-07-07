import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { supabase } from "../lib/supabase";
import { MonthNav } from "../components/Ui";
import { daysInMonth, monthRange, num, thisMonth, won } from "../lib/utils";

export default function Dashboard() {
  const [ym, setYm] = useState(thisMonth());
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const load = useCallback(async () => {
    const { start, end } = monthRange(ym);
    const [s, e] = await Promise.all([
      supabase.from("sales").select("*").gte("sale_date", start).lt("sale_date", end),
      supabase.from("expenses").select("*").gte("expense_date", start).lt("expense_date", end),
    ]);
    setSales(s.data ?? []);
    setExpenses(e.data ?? []);
  }, [ym]);

  useEffect(() => { load(); }, [load]);

  const stat = useMemo(() => {
    const sum = (arr, f) => arr.reduce((a, r) => a + Number(f(r) ?? 0), 0);
    const card = sales.filter((r) => r.payment_method === "card");
    const cash = sales.filter((r) => r.payment_method === "cash");
    const settled = card.filter((r) => r.net_amount != null);
    const pending = card.filter((r) => r.net_amount == null);

    const cardGross = sum(card, (r) => r.amount);
    const cashSum = sum(cash, (r) => r.amount);
    // 실수령 기준 매출: 현금 + 카드 정산액(미정산 건은 결제금액으로 임시 집계)
    const netRevenue =
      cashSum + sum(settled, (r) => r.net_amount) + sum(pending, (r) => r.amount);
    const fee = sum(settled, (r) => r.amount - r.net_amount);
    const feeRate = sum(settled, (r) => r.amount) > 0
      ? (fee / sum(settled, (r) => r.amount)) * 100
      : 0;

    const material = sum(expenses.filter((x) => x.kind === "material"), (r) => r.amount);
    const ledgerRows = expenses.filter((x) => x.kind === "ledger");
    const ledgerExpense = sum(ledgerRows.filter((x) => x.entry_type !== "income"), (r) => r.amount);
    const ledgerIncome = sum(ledgerRows.filter((x) => x.entry_type === "income"), (r) => r.amount);

    return {
      gross: cardGross + cashSum,
      cardGross,
      cashSum,
      netRevenue,
      fee,
      feeRate,
      pendingCnt: pending.length,
      pendingAmt: sum(pending, (r) => r.amount),
      material,
      ledgerExpense,
      ledgerIncome,
      profit: netRevenue + ledgerIncome - material - ledgerExpense,
    };
  }, [sales, expenses]);

  const daily = useMemo(() => {
    const n = daysInMonth(ym);
    const arr = Array.from({ length: n }, (_, i) => ({ day: `${i + 1}`, 카드: 0, 현금: 0 }));
    for (const r of sales) {
      const d = Number(r.sale_date.slice(8, 10)) - 1;
      if (arr[d]) arr[d][r.payment_method === "card" ? "카드" : "현금"] += Number(r.amount);
    }
    for (const row of arr) row.총합 = row.카드 + row.현금;
    return arr;
  }, [sales, ym]);

  // 지출 = 재료비 + 가계부 거래내역의 지출 항목 (수입 제외)
  const calendarDays = useMemo(() => {
    const expenseByDay = {};
    for (const r of expenses) {
      if (r.kind === "material" || (r.kind === "ledger" && r.entry_type !== "income")) {
        const d = Number(r.expense_date.slice(8, 10));
        expenseByDay[d] = (expenseByDay[d] ?? 0) + Number(r.amount);
      }
    }
    return daily.map((row, i) => {
      const day = i + 1;
      const expense = expenseByDay[day] ?? 0;
      return { day, sales: row.총합, expense, total: row.총합 - expense };
    });
  }, [daily, expenses]);

  const [calY, calM] = ym.split("-").map(Number);
  const calLeadBlanks = new Date(calY, calM - 1, 1).getDay();
  const DOW = ["일", "월", "화", "수", "목", "금", "토"];

  const cardPct = stat.gross > 0 ? Math.round((stat.cardGross / stat.gross) * 100) : 0;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">홈</h1>
        <MonthNav ym={ym} onChange={setYm} />
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">{ym} 총매출 (수수료 제외 정산 기준)</div>
          <div className="value">{won(stat.netRevenue)}</div>
          <div className="sub">결제 기준 {won(stat.gross)}</div>
        </div>
        <div className="stat-card">
          <div className="label">순이익 (매출 + 가계부수입 − 재료비 − 가계부지출)</div>
          <div className={`value ${stat.profit >= 0 ? "pos" : "neg"}`}>{won(stat.profit)}</div>
          <div className="sub">재료비 {won(stat.material)} · 가계부 지출 {won(stat.ledgerExpense)} · 수입 {won(stat.ledgerIncome)}</div>
        </div>
        <div className="stat-card">
          <div className="label">카드 수수료</div>
          <div className="value warn">{won(stat.fee)}</div>
          <div className="sub">실효 수수료율 {stat.feeRate.toFixed(2)}% (정산 완료분 기준)</div>
        </div>
        <div className="stat-card">
          <div className="label">정산대기 카드</div>
          <div className="value">{stat.pendingCnt}건</div>
          <div className="sub">{won(stat.pendingAmt)} · 매출관리 탭에서 정산액 입력</div>
        </div>
      </div>

      <div className="panel">
        <h3>{ym} 캘린더</h3>
        <div className="calendar">
          {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
          {Array.from({ length: calLeadBlanks }).map((_, i) => (
            <div key={`b${i}`} className="cal-day empty" />
          ))}
          {calendarDays.map((c) => (
            <div key={c.day} className="cal-day">
              <div className="d">{c.day}</div>
              {c.sales > 0 && <div className="cal-sales">+{num(c.sales)}</div>}
              {c.expense > 0 && <div className="cal-expense">-{num(c.expense)}</div>}
              {(c.sales > 0 || c.expense > 0) && (
                <div className={`cal-total ${c.total >= 0 ? "pos" : "neg"}`}>{num(c.total)}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>일별 매출</h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={daily} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickFormatter={num} tickLine={false} axisLine={false} fontSize={11} width={72} />
            <Tooltip formatter={(v) => won(v)} labelFormatter={(d) => `${ym}-${String(d).padStart(2, "0")}`} />
            <Legend />
            <Bar dataKey="카드" stackId="a" fill="#2456d6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="현금" stackId="a" fill="#1a9e6e" radius={[3, 3, 0, 0]} />
            <Line type="monotone" dataKey="총합" stroke="#f5a524" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <h3>카드 · 현금 비중</h3>
        <div className="ratio-bar">
          <div className="card" style={{ width: `${cardPct}%` }} />
          <div className="cash" style={{ width: `${100 - cardPct}%` }} />
        </div>
        <div className="legend">
          <span><span className="dot" style={{ background: "#2456d6" }} />카드 {cardPct}% · {won(stat.cardGross)}</span>
          <span><span className="dot" style={{ background: "#1a9e6e" }} />현금 {100 - cardPct}% · {won(stat.cashSum)}</span>
        </div>
      </div>
    </div>
  );
}
