import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Modal, MonthNav } from "../../components/Ui";
import { monthRange, thisMonth, today, won } from "../../lib/utils";

const EMPTY = {
  entry_type: "expense",
  major: "", minor: "",
  account_id: "", to_account_id: "",
  budget_id: "",
  amount: "", memo: "",
};
const TYPE_LABEL = { income: "수입", expense: "지출", transfer: "이체" };
const ACCOUNT_TYPE_LABEL = { bank: "통장", card: "카드", savings: "적금", stock: "주식" };

export default function Transactions({ user }) {
  const [ym, setYm] = useState(thisMonth());
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);       // ledger_categories 전체
  const [accounts, setAccounts] = useState([]); // 계좌관리 탭의 계좌 목록
  const [budgets, setBudgets] = useState([]);   // 예산구분

  const [modal, setModal] = useState(null);
  const [catModal, setCatModal] = useState(false);
  const [catType, setCatType] = useState("expense");
  const [selMajor, setSelMajor] = useState(null);
  const [newMajor, setNewMajor] = useState("");
  const [newMinor, setNewMinor] = useState("");
  const [budgetModal, setBudgetModal] = useState(false);
  const [newBudget, setNewBudget] = useState("");
  const [busy, setBusy] = useState(false);

  const loadCats = useCallback(async () => {
    const { data } = await supabase.from("ledger_categories").select("*").order("created_at");
    setCats(data ?? []);
  }, []);

  const loadAccounts = useCallback(async () => {
    const { data } = await supabase.from("accounts").select("id,type,nickname").order("created_at");
    setAccounts(data ?? []);
  }, []);

  const loadBudgets = useCallback(async () => {
    const { data } = await supabase.from("budgets").select("*").order("created_at");
    setBudgets(data ?? []);
  }, []);

  const load = useCallback(async () => {
    const { start, end } = monthRange(ym);
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("kind", "ledger")
      .gte("expense_date", start)
      .lt("expense_date", end)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  }, [ym]);

  useEffect(() => { load(); loadCats(); loadAccounts(); loadBudgets(); }, [load, loadCats, loadAccounts, loadBudgets]);

  const majors = useCallback(
    (type) => cats.filter((c) => c.entry_type === type && c.parent_id == null),
    [cats]
  );
  const minors = useCallback(
    (majorId) => cats.filter((c) => c.parent_id === majorId),
    [cats]
  );

  const accountLabel = useCallback((id) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${ACCOUNT_TYPE_LABEL[a.type]} · ${a.nickname}` : null;
  }, [accounts]);

  const stat = useMemo(() => {
    const sum = (arr) => arr.reduce((a, r) => a + Number(r.amount), 0);
    const income = sum(rows.filter((r) => r.entry_type === "income"));
    const expense = sum(rows.filter((r) => r.entry_type === "expense"));
    return { income, expense, diff: income - expense };
  }, [rows]);

  const budgetUsage = useMemo(() => {
    const map = {};
    for (const r of rows) {
      if (r.entry_type === "expense" && r.budget_id) {
        map[r.budget_id] = (map[r.budget_id] ?? 0) + Number(r.amount);
      }
    }
    return map;
  }, [rows]);

  const setForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }));

  // ── 카테고리(분류/항목) CRUD ───────────
  async function addCat(parent_id, name, done) {
    const n = name.trim();
    if (!n) return;
    const { error } = await supabase
      .from("ledger_categories")
      .insert({ user_id: user.id, entry_type: catType, parent_id, name: n });
    if (error) return alert("추가 실패: " + error.message);
    done();
    loadCats();
  }
  async function renameCat(c) {
    const name = prompt("이름 수정", c.name)?.trim();
    if (!name || name === c.name) return;
    await supabase.from("ledger_categories").update({ name }).eq("id", c.id);
    loadCats();
  }
  async function removeCat(c, isMajor) {
    const msg = isMajor
      ? `'${c.name}' 대분류를 삭제할까요? 하위 중분류도 함께 삭제됩니다.\n(기존 등록 건의 표기는 유지됩니다)`
      : `'${c.name}' 중분류를 삭제할까요?`;
    if (!confirm(msg)) return;
    await supabase.from("ledger_categories").delete().eq("id", c.id);
    if (isMajor && selMajor?.id === c.id) setSelMajor(null);
    loadCats();
  }

  // ── 예산구분 CRUD ─────────────────────
  async function addBudget() {
    const name = newBudget.trim();
    if (!name) return;
    const { error } = await supabase.from("budgets").insert({ user_id: user.id, name, monthly_amount: 0 });
    if (error) return alert("추가 실패: " + error.message);
    setNewBudget("");
    loadBudgets();
  }
  async function renameBudget(b) {
    const name = prompt("이름 수정", b.name)?.trim();
    if (!name || name === b.name) return;
    await supabase.from("budgets").update({ name }).eq("id", b.id);
    loadBudgets();
  }
  async function removeBudget(b) {
    if (!confirm(`'${b.name}' 예산구분을 삭제할까요?\n(기존 등록 건의 연결은 해제됩니다)`)) return;
    await supabase.from("budgets").delete().eq("id", b.id);
    loadBudgets();
  }
  async function updateBudgetAmount(b, value) {
    const amt = Number(value);
    if (Number.isNaN(amt) || amt === Number(b.monthly_amount)) return;
    await supabase.from("budgets").update({ monthly_amount: amt }).eq("id", b.id);
    loadBudgets();
  }

  // ── 등록/수정/삭제 ────────────────────
  async function save() {
    const f = modal.form;
    if (!f.expense_date || !f.amount) return alert("날짜와 금액을 입력하세요.");

    let payload;
    if (f.entry_type === "transfer") {
      if (!f.account_id || !f.to_account_id) return alert("보내는 계좌와 받는 계좌를 선택하세요.");
      if (f.account_id === f.to_account_id) return alert("보내는 계좌와 받는 계좌가 같을 수 없습니다.");
      payload = {
        expense_date: f.expense_date,
        amount: Number(f.amount),
        entry_type: "transfer",
        category: null,
        account_id: f.account_id,
        to_account_id: f.to_account_id,
        budget_id: null,
        memo: f.memo || null,
        kind: "ledger",
      };
    } else {
      if (!f.major) return alert("대분류를 선택하세요.");
      payload = {
        expense_date: f.expense_date,
        amount: Number(f.amount),
        entry_type: f.entry_type,
        category: f.minor ? `${f.major} > ${f.minor}` : f.major,
        account_id: f.account_id || null,
        to_account_id: null,
        budget_id: f.entry_type === "expense" ? (f.budget_id || null) : null,
        memo: f.memo || null,
        kind: "ledger",
      };
    }

    setBusy(true);
    const q =
      modal.mode === "new"
        ? supabase.from("expenses").insert({ ...payload, user_id: user.id })
        : supabase.from("expenses").update(payload).eq("id", modal.id);
    const { error } = await q;
    setBusy(false);
    if (error) return alert("저장 실패: " + error.message);
    setModal(null);
    load();
  }

  async function remove(id) {
    if (!confirm("삭제할까요?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    load();
  }

  function openEdit(r) {
    const [major, minor] = (r.category ?? "").split(" > ");
    setModal({
      mode: "edit",
      id: r.id,
      form: {
        expense_date: r.expense_date,
        entry_type: r.entry_type ?? "expense",
        major: major ?? "",
        minor: minor ?? "",
        account_id: r.account_id ?? "",
        to_account_id: r.to_account_id ?? "",
        budget_id: r.budget_id ?? "",
        amount: String(r.amount),
        memo: r.memo ?? "",
      },
    });
  }

  const formMajors = modal ? majors(modal.form.entry_type) : [];
  const formMajorObj = formMajors.find((c) => c.name === modal?.form.major);
  const formMinors = formMajorObj ? minors(formMajorObj.id) : [];
  const isTransfer = modal?.form.entry_type === "transfer";

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">지출내역</h1>
        <MonthNav ym={ym} onChange={setYm} />
        <div className="spacer" />
        <button className="btn" onClick={() => { setCatModal(true); setSelMajor(null); }}>
          카테고리 관리
        </button>
        <button
          className="btn primary"
          onClick={() => setModal({ mode: "new", form: { ...EMPTY, expense_date: today() } })}
        >
          + 내역 등록
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">{ym} 수입</div>
          <div className="value pos">{won(stat.income)}</div>
        </div>
        <div className="stat-card">
          <div className="label">{ym} 지출</div>
          <div className="value neg">{won(stat.expense)}</div>
        </div>
        <div className="stat-card">
          <div className="label">차액 (수입 − 지출)</div>
          <div className={`value ${stat.diff >= 0 ? "pos" : "neg"}`}>{won(stat.diff)}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>예산 현황 ({ym})</h3>
          <button className="btn sm" onClick={() => setBudgetModal(true)}>구분 관리</button>
        </div>
        <div className="budget-grid">
          {budgets.length === 0 && <span className="chip-empty">등록된 예산구분이 없습니다. ‘구분 관리’에서 추가하세요.</span>}
          {budgets.map((b) => {
            const used = budgetUsage[b.id] ?? 0;
            const remain = Number(b.monthly_amount) - used;
            const pct = Number(b.monthly_amount) > 0 ? Math.min(100, (used / Number(b.monthly_amount)) * 100) : 0;
            return (
              <div className="budget-card" key={b.id}>
                <div className="label">{b.name}</div>
                <div className="budget-amt-row">
                  <span className="sub">월 예산</span>
                  <input
                    key={b.monthly_amount}
                    className="input sm r"
                    type="number"
                    defaultValue={b.monthly_amount}
                    onBlur={(e) => updateBudgetAmount(b, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                  />
                </div>
                <div className="budget-bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
                <div className="sub">
                  사용 {won(used)} · 잔액{" "}
                  <b className={remain >= 0 ? "pos" : "neg"}>{won(remain)}</b>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>날짜</th><th>구분</th><th>분류</th><th>계좌</th><th>메모</th><th className="r">금액</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="empty">등록된 내역이 없습니다.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.expense_date}</td>
                <td>
                  <span className={`badge ${r.entry_type}`}>
                    {TYPE_LABEL[r.entry_type] ?? "지출"}
                  </span>
                </td>
                <td>
                  {r.entry_type === "transfer"
                    ? <span className="muted">—</span>
                    : <span className="badge done">{r.category}</span>}
                </td>
                <td className="muted">
                  {r.entry_type === "transfer"
                    ? `${accountLabel(r.account_id) ?? "—"} → ${accountLabel(r.to_account_id) ?? "—"}`
                    : (accountLabel(r.account_id) ?? "—")}
                </td>
                <td className="muted">{r.memo}</td>
                <td className="r">{won(r.amount)}</td>
                <td className="r" style={{ whiteSpace: "nowrap" }}>
                  <button className="btn sm" onClick={() => openEdit(r)}>수정</button>{" "}
                  <button className="btn sm danger" onClick={() => remove(r.id)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 카테고리 관리 모달 */}
      {catModal && (
        <Modal wide title="가계부 카테고리 관리" onClose={() => setCatModal(false)}>
          <div className="field">
            <label>구분</label>
            <div className="seg">
              <button className={`expense ${catType === "expense" ? "on" : ""}`}
                onClick={() => { setCatType("expense"); setSelMajor(null); }}>지출</button>
              <button className={`income ${catType === "income" ? "on" : ""}`}
                onClick={() => { setCatType("income"); setSelMajor(null); }}>수입</button>
            </div>
          </div>

          <div className="subhead">대분류 (클릭=중분류 보기, 더블클릭=이름 수정)</div>
          <div className="chip-row">
            {majors(catType).length === 0 && <span className="chip-empty">대분류가 없습니다.</span>}
            {majors(catType).map((c) => (
              <span key={c.id}
                className={`chip ${selMajor?.id === c.id ? "on" : ""}`}
                onClick={() => setSelMajor(c)}
                onDoubleClick={() => renameCat(c)}>
                {c.name}
                <button className="x" onClick={(e) => { e.stopPropagation(); removeCat(c, true); }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input className="input" placeholder="새 대분류 (예: 교통비, 식비)"
              value={newMajor}
              onChange={(e) => setNewMajor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCat(null, newMajor, () => setNewMajor(""))} />
            <button className="btn primary" onClick={() => addCat(null, newMajor, () => setNewMajor(""))}>
              추가
            </button>
          </div>

          {selMajor && (
            <>
              <div className="subhead">‘{selMajor.name}’의 중분류 (클릭=이름 수정)</div>
              <div className="chip-row">
                {minors(selMajor.id).length === 0 && <span className="chip-empty">중분류가 없습니다.</span>}
                {minors(selMajor.id).map((c) => (
                  <span key={c.id} className="chip" onClick={() => renameCat(c)}>
                    {c.name}
                    <button className="x" onClick={(e) => { e.stopPropagation(); removeCat(c, false); }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input className="input" placeholder="새 중분류 (예: 택시비, 배달)"
                  value={newMinor}
                  onChange={(e) => setNewMinor(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCat(selMajor.id, newMinor, () => setNewMinor(""))} />
                <button className="btn primary"
                  onClick={() => addCat(selMajor.id, newMinor, () => setNewMinor(""))}>
                  추가
                </button>
              </div>
            </>
          )}

          <div className="modal-actions">
            <button className="btn" onClick={() => setCatModal(false)}>닫기</button>
          </div>
        </Modal>
      )}

      {/* 예산구분 관리 모달 */}
      {budgetModal && (
        <Modal title="예산구분 관리" onClose={() => setBudgetModal(false)}>
          <div className="field">
            <label>새 예산구분 추가</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" placeholder="예: 용돈, 고정비, 생활비"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addBudget()} />
              <button className="btn primary" onClick={addBudget}>추가</button>
            </div>
          </div>
          <div className="subhead">예산구분 (클릭=이름 수정, ×=삭제)</div>
          <div className="chip-row">
            {budgets.length === 0 && <span className="chip-empty">아직 예산구분이 없습니다.</span>}
            {budgets.map((b) => (
              <span key={b.id} className="chip" onClick={() => renameBudget(b)}>
                {b.name}
                <button className="x" onClick={(e) => { e.stopPropagation(); removeBudget(b); }}>×</button>
              </span>
            ))}
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setBudgetModal(false)}>닫기</button>
          </div>
        </Modal>
      )}

      {/* 등록/수정 모달 */}
      {modal && (
        <Modal title={modal.mode === "new" ? "내역 등록" : "내역 수정"} onClose={() => setModal(null)}>
          <div className="field">
            <label>구분</label>
            <div className="seg">
              <button className={`expense ${modal.form.entry_type === "expense" ? "on" : ""}`}
                onClick={() => setForm({ entry_type: "expense", major: "", minor: "" })}>지출</button>
              <button className={`income ${modal.form.entry_type === "income" ? "on" : ""}`}
                onClick={() => setForm({ entry_type: "income", major: "", minor: "" })}>수입</button>
              <button className={`transfer ${modal.form.entry_type === "transfer" ? "on" : ""}`}
                onClick={() => setForm({ entry_type: "transfer", major: "", minor: "", budget_id: "" })}>이체</button>
            </div>
          </div>
          <div className="field">
            <label>날짜</label>
            <input className="input" type="date" value={modal.form.expense_date}
              onChange={(e) => setForm({ expense_date: e.target.value })} />
          </div>

          {!isTransfer && (
            <>
              <div className="field">
                <label>대분류</label>
                <select className="input" value={modal.form.major}
                  onChange={(e) => setForm({ major: e.target.value, minor: "" })}>
                  <option value="">선택</option>
                  {formMajors.map((c) => <option key={c.id}>{c.name}</option>)}
                </select>
                {formMajors.length === 0 && (
                  <div className="hint">‘카테고리 관리’에서 {TYPE_LABEL[modal.form.entry_type]} 대분류를 먼저 추가하세요.</div>
                )}
              </div>
              <div className="field">
                <label>중분류 (선택)</label>
                <select className="input" value={modal.form.minor}
                  onChange={(e) => setForm({ minor: e.target.value })}
                  disabled={!formMajorObj || formMinors.length === 0}>
                  <option value="">선택 안 함</option>
                  {formMinors.map((c) => <option key={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>결제수단/계좌 (선택)</label>
                <select className="input" value={modal.form.account_id}
                  onChange={(e) => setForm({ account_id: e.target.value })}>
                  <option value="">선택 안 함</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{ACCOUNT_TYPE_LABEL[a.type]} · {a.nickname}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {isTransfer && (
            <>
              <div className="field">
                <label>보내는 계좌</label>
                <select className="input" value={modal.form.account_id}
                  onChange={(e) => setForm({ account_id: e.target.value })}>
                  <option value="">선택</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{ACCOUNT_TYPE_LABEL[a.type]} · {a.nickname}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>받는 계좌</label>
                <select className="input" value={modal.form.to_account_id}
                  onChange={(e) => setForm({ to_account_id: e.target.value })}>
                  <option value="">선택</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{ACCOUNT_TYPE_LABEL[a.type]} · {a.nickname}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="field">
            <label>금액</label>
            <input className="input r" type="number" value={modal.form.amount}
              onChange={(e) => setForm({ amount: e.target.value })} />
          </div>

          {modal.form.entry_type === "expense" && (
            <div className="field">
              <label>예산구분 (선택)</label>
              <div className="chip-row">
                <span className={`chip ${!modal.form.budget_id ? "on" : ""}`}
                  onClick={() => setForm({ budget_id: "" })}>없음</span>
                {budgets.map((b) => (
                  <span key={b.id}
                    className={`chip ${modal.form.budget_id === b.id ? "on" : ""}`}
                    onClick={() => setForm({ budget_id: b.id })}>
                    {b.name}
                  </span>
                ))}
              </div>
              {budgets.length === 0 && (
                <div className="hint">‘구분 관리’에서 예산구분을 먼저 추가하세요.</div>
              )}
            </div>
          )}

          <div className="field">
            <label>메모 (선택)</label>
            <input className="input" value={modal.form.memo}
              onChange={(e) => setForm({ memo: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setModal(null)}>취소</button>
            <button className="btn primary" onClick={save} disabled={busy}>
              {modal.mode === "new" ? "등록" : "저장"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
