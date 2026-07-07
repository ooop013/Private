import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { DayNav, Modal } from "../components/Ui";
import { settledAmount, today, won } from "../lib/utils";

const EMPTY = { sale_date: "", payment_method: "card", amount: "", net_amount: "", memo: "" };

export default function Sales({ user }) {
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all"); // all | card | cash | pending
  const [modal, setModal] = useState(null);
  const [settleInput, setSettleInput] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .eq("sale_date", date)
      .order("created_at", { ascending: false });
    if (!error) setRows(data ?? []);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const view = useMemo(() => {
    if (filter === "card") return rows.filter((r) => r.payment_method === "card");
    if (filter === "cash") return rows.filter((r) => r.payment_method === "cash");
    if (filter === "pending")
      return rows.filter((r) => r.payment_method === "card" && r.net_amount == null);
    return rows;
  }, [rows, filter]);

  const stat = useMemo(() => {
    const sum = (arr, f) => arr.reduce((a, r) => a + Number(f(r) ?? 0), 0);
    const card = rows.filter((r) => r.payment_method === "card");
    const cash = rows.filter((r) => r.payment_method === "cash");
    const settled = card.filter((r) => r.net_amount != null);
    const pending = card.filter((r) => r.net_amount == null);
    const cardNet = sum(card, settledAmount);   // 정산 기준 (미정산은 결제금액 임시)
    const cashSum = sum(cash, (r) => r.amount);
    return {
      totalNet: cardNet + cashSum,              // 총매출 (정산 기준)
      totalGross: sum(rows, (r) => r.amount),   // 참고: 결제 기준
      cardNet,
      cardGross: sum(card, (r) => r.amount),
      cash: cashSum,
      fee: sum(settled, (r) => r.amount - r.net_amount),
      pendingCnt: pending.length,
      pendingAmt: sum(pending, (r) => r.amount),
    };
  }, [rows]);

  function openNew() {
    setModal({ mode: "new", form: { ...EMPTY, sale_date: date } });
  }
  function openEdit(r) {
    setModal({
      mode: "edit",
      id: r.id,
      form: {
        sale_date: r.sale_date,
        payment_method: r.payment_method,
        amount: String(r.amount),
        net_amount: r.net_amount == null ? "" : String(r.net_amount),
        memo: r.memo ?? "",
      },
    });
  }
  const setForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }));

  async function save() {
    const f = modal.form;
    if (!f.sale_date || !f.amount) return alert("날짜와 금액을 입력하세요.");
    const payload = {
      sale_date: f.sale_date,
      payment_method: f.payment_method,
      amount: Number(f.amount),
      net_amount:
        f.payment_method === "card" && f.net_amount !== "" ? Number(f.net_amount) : null,
      memo: f.memo || null,
    };
    setBusy(true);
    const q =
      modal.mode === "new"
        ? supabase.from("sales").insert({ ...payload, user_id: user.id })
        : supabase.from("sales").update(payload).eq("id", modal.id);
    const { error } = await q;
    setBusy(false);
    if (error) return alert("저장 실패: " + error.message);
    setModal(null);
    load();
  }

  async function remove(id) {
    if (!confirm("이 매출 건을 삭제할까요?")) return;
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) return alert("삭제 실패: " + error.message);
    load();
  }

  async function settle(r) {
    const v = settleInput[r.id];
    if (v == null || v === "") return;
    const { error } = await supabase
      .from("sales")
      .update({ net_amount: Number(v) })
      .eq("id", r.id);
    if (error) return alert("저장 실패: " + error.message);
    setSettleInput((s) => ({ ...s, [r.id]: "" }));
    load();
  }

  const isCard = modal?.form.payment_method === "card";

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">매출관리</h1>
        <DayNav date={date} onChange={setDate} />
        <div className="spacer" />
        <div className="filters">
          <select className="input" style={{ width: 150 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">전체</option>
            <option value="card">카드만</option>
            <option value="cash">현금만</option>
            <option value="pending">정산대기만</option>
          </select>
          <button className="btn primary" onClick={openNew}>+ 매출 등록</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">총매출 (수수료 제외 정산 기준)</div>
          <div className="value">{won(stat.totalNet)}</div>
          <div className="sub">결제 기준 {won(stat.totalGross)}</div>
        </div>
        <div className="stat-card">
          <div className="label">카드 (수수료 제외)</div>
          <div className="value">{won(stat.cardNet)}</div>
          <div className="sub">결제 기준 {won(stat.cardGross)}</div>
        </div>
        <div className="stat-card">
          <div className="label">현금</div>
          <div className="value">{won(stat.cash)}</div>
        </div>
        <div className="stat-card">
          <div className="label">카드 수수료 (정산 완료분)</div>
          <div className="value warn">{won(stat.fee)}</div>
          <div className="sub">정산대기 {stat.pendingCnt}건 · {won(stat.pendingAmt)}</div>
        </div>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>구분</th>
              <th className="r">결제금액</th>
              <th className="r">정산금액 (수수료 제외)</th>
              <th className="r">수수료</th>
              <th>상태</th>
              <th>메모</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {view.length === 0 && (
              <tr><td colSpan={7} className="empty">{date} 매출이 없습니다. ‘매출 등록’으로 추가하세요.</td></tr>
            )}
            {view.map((r) => {
              const pending = r.payment_method === "card" && r.net_amount == null;
              const fee = r.payment_method === "card" && r.net_amount != null
                ? r.amount - r.net_amount
                : null;
              return (
                <tr key={r.id}>
                  <td>
                    <span className={`badge ${r.payment_method}`}>
                      {r.payment_method === "card" ? "카드" : "현금"}
                    </span>
                  </td>
                  <td className="r">{won(r.amount)}</td>
                  <td className="r">
                    {r.payment_method === "cash" ? (
                      <span className="muted">—</span>
                    ) : pending ? (
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <input
                          className="input sm r"
                          type="number"
                          placeholder="정산액 입력"
                          value={settleInput[r.id] ?? ""}
                          onChange={(e) => setSettleInput((s) => ({ ...s, [r.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && settle(r)}
                        />
                        <button className="btn sm" onClick={() => settle(r)}>저장</button>
                      </span>
                    ) : (
                      won(r.net_amount)
                    )}
                  </td>
                  <td className="r">{fee == null ? <span className="muted">—</span> : won(fee)}</td>
                  <td>
                    {r.payment_method === "card" ? (
                      <span className={`badge ${pending ? "pending" : "done"}`}>
                        {pending ? "정산대기" : "정산완료"}
                      </span>
                    ) : (
                      <span className="badge done">완료</span>
                    )}
                  </td>
                  <td className="muted">{r.memo}</td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    <button className="btn sm" onClick={() => openEdit(r)}>수정</button>{" "}
                    <button className="btn sm danger" onClick={() => remove(r.id)}>삭제</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          title={modal.mode === "new" ? "매출 등록" : "매출 수정"}
          onClose={() => setModal(null)}
        >
          <div className="field">
            <label>날짜</label>
            <input className="input" type="date" value={modal.form.sale_date}
              onChange={(e) => setForm({ sale_date: e.target.value })} />
          </div>
          <div className="field">
            <label>결제수단</label>
            <div className="seg">
              <button className={`card ${isCard ? "on" : ""}`}
                onClick={() => setForm({ payment_method: "card" })}>카드</button>
              <button className={`cash ${!isCard ? "on" : ""}`}
                onClick={() => setForm({ payment_method: "cash", net_amount: "" })}>현금</button>
            </div>
          </div>
          <div className="field">
            <label>결제금액</label>
            <input className="input r" type="number" placeholder="예: 50000"
              value={modal.form.amount}
              onChange={(e) => setForm({ amount: e.target.value })} />
          </div>
          {isCard && (
            <div className="field">
              <label>정산금액 (수수료 제외)</label>
              <input className="input r" type="number" placeholder="아직 모르면 비워두세요"
                value={modal.form.net_amount}
                onChange={(e) => setForm({ net_amount: e.target.value })} />
              <div className="hint">
                비워두면 ‘정산대기’로 표시되고, 목록에서 바로 입력할 수 있습니다.
              </div>
            </div>
          )}
          <div className="field">
            <label>메모 (선택)</label>
            <input className="input" value={modal.form.memo}
              onChange={(e) => setForm({ memo: e.target.value })} placeholder="손님/품목 등" />
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setModal(null)}>취소</button>
            <button className="btn primary" onClick={save} disabled={busy}>
              {modal.mode === "new" ? "등록" : "저장"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
