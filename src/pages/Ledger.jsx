import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Modal, MonthNav } from "../components/Ui";
import { monthRange, thisMonth, today, won } from "../lib/utils";

const EMPTY = { expense_date: "", entry_type: "expense", major: "", minor: "", amount: "", memo: "" };
const TYPE_LABEL = { income: "수입", expense: "지출" };

export default function Ledger({ user }) {
  const [ym, setYm] = useState(thisMonth());
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]); // ledger_categories 전체
  const [modal, setModal] = useState(null);
  const [catModal, setCatModal] = useState(false);
  const [catType, setCatType] = useState("expense"); // 관리 모달의 수입/지출 탭
  const [selMajor, setSelMajor] = useState(null);    // 관리 모달에서 선택된 대분류
  const [newMajor, setNewMajor] = useState("");
  const [newMinor, setNewMinor] = useState("");
  const [busy, setBusy] = useState(false);

  const loadCats = useCallback(async () => {
    const { data } = await supabase.from("ledger_categories").select("*").order("created_at");
    setCats(data ?? []);
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

  useEffect(() => { load(); loadCats(); }, [load, loadCats]);

  const majors = useCallback(
    (type) => cats.filter((c) => c.entry_type === type && c.parent_id == null),
    [cats]
  );
  const minors = useCallback(
    (majorId) => cats.filter((c) => c.parent_id === majorId),
    [cats]
  );

  const stat = useMemo(() => {
    const sum = (arr) => arr.reduce((a, r) => a + Number(r.amount), 0);
    const income = sum(rows.filter((r) => r.entry_type === "income"));
    const expense = sum(rows.filter((r) => r.entry_type !== "income"));
    return { income, expense, diff: income - expense };
  }, [rows]);

  const setForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }));

  // ── 카테고리 CRUD ─────────────────────
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

  // ── 등록/수정/삭제 ────────────────────
  async function save() {
    const f = modal.form;
    if (!f.expense_date || !f.amount) return alert("날짜와 금액을 입력하세요.");
    if (!f.major) return alert("대분류를 선택하세요.");
    const category = f.minor ? `${f.major} > ${f.minor}` : f.major;
    const payload = {
      expense_date: f.expense_date,
      amount: Number(f.amount),
      entry_type: f.entry_type,
      category,
      memo: f.memo || null,
      kind: "ledger",
    };
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
        amount: String(r.amount),
        memo: r.memo ?? "",
      },
    });
  }

  const formMajors = modal ? majors(modal.form.entry_type) : [];
  const formMajorObj = formMajors.find((c) => c.name === modal?.form.major);
  const formMinors = formMajorObj ? minors(formMajorObj.id) : [];

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">가계부</h1>
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
        <table className="table">
          <thead>
            <tr>
              <th>날짜</th><th>구분</th><th>분류</th><th>메모</th><th className="r">금액</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="empty">등록된 내역이 없습니다.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.expense_date}</td>
                <td>
                  <span className={`badge ${r.entry_type === "income" ? "income" : "expense"}`}>
                    {TYPE_LABEL[r.entry_type] ?? "지출"}
                  </span>
                </td>
                <td><span className="badge done">{r.category}</span></td>
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
            </div>
          </div>
          <div className="field">
            <label>날짜</label>
            <input className="input" type="date" value={modal.form.expense_date}
              onChange={(e) => setForm({ expense_date: e.target.value })} />
          </div>
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
            <label>금액</label>
            <input className="input r" type="number" value={modal.form.amount}
              onChange={(e) => setForm({ amount: e.target.value })} />
          </div>
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
    </div>
  );
}
