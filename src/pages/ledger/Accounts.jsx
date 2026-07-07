import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Modal } from "../../components/Ui";
import { won } from "../../lib/utils";

const TYPES = ["bank", "card", "savings", "stock"];
const TYPE_LABEL = { bank: "통장", card: "카드", savings: "적금", stock: "주식" };

// 유형별 입력/표시 필드 정의 (순서대로 폼과 표에 렌더링됨)
const FIELD_DEFS = {
  bank: [
    { key: "nickname", label: "별칭", required: true },
    { key: "institution", label: "은행명", required: true },
    { key: "account_number", label: "계좌번호", required: true },
    { key: "memo", label: "메모 (용도)" },
  ],
  card: [
    { key: "nickname", label: "별칭", required: true },
    { key: "institution", label: "카드사", required: true },
    { key: "account_number", label: "카드번호", required: true },
    { key: "cvc", label: "CVC", required: true },
    { key: "expiry_date", label: "만기일", type: "date", required: true },
    { key: "memo", label: "메모 (용도)" },
  ],
  savings: [
    { key: "nickname", label: "별칭", required: true },
    { key: "institution", label: "은행사", required: true },
    { key: "account_number", label: "계좌번호", required: true },
    { key: "expiry_date", label: "만기일", type: "date", required: true },
    { key: "interest_rate", label: "적용금리 (%)", type: "number", required: true, money: "percent" },
    { key: "deposit_amount", label: "납입금액", type: "number", required: true, money: "won" },
    { key: "memo", label: "메모 (용도)" },
  ],
  stock: [
    { key: "nickname", label: "별칭", required: true },
    { key: "institution", label: "은행사", required: true },
    { key: "account_number", label: "계좌번호", required: true },
    { key: "amount", label: "금액", type: "number", required: true, money: "won" },
    { key: "memo", label: "메모 (용도)" },
  ],
};

function emptyForm(type) {
  const form = {};
  for (const f of FIELD_DEFS[type]) form[f.key] = "";
  return form;
}

function display(field, value) {
  if (value == null || value === "") return <span className="muted">—</span>;
  if (field.money === "won") return won(value);
  if (field.money === "percent") return `${value}%`;
  return value;
}

export default function Accounts({ user }) {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(null); // { mode, id?, type, form }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew(type) {
    setModal({ mode: "new", type, form: emptyForm(type) });
  }
  function openEdit(r) {
    const form = emptyForm(r.type);
    for (const k of Object.keys(form)) form[k] = r[k] == null ? "" : String(r[k]);
    setModal({ mode: "edit", id: r.id, type: r.type, form });
  }
  const setForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }));

  async function save() {
    const fields = FIELD_DEFS[modal.type];
    for (const f of fields) {
      if (f.required && !modal.form[f.key]) return alert(`${f.label}을(를) 입력하세요.`);
    }
    const payload = { type: modal.type };
    for (const f of fields) {
      const v = modal.form[f.key];
      payload[f.key] = f.type === "number" ? (v === "" ? null : Number(v)) : (v || null);
    }
    setBusy(true);
    const q =
      modal.mode === "new"
        ? supabase.from("accounts").insert({ ...payload, user_id: user.id })
        : supabase.from("accounts").update(payload).eq("id", modal.id);
    const { error } = await q;
    setBusy(false);
    if (error) return alert("저장 실패: " + error.message);
    setModal(null);
    load();
  }

  async function remove(id) {
    if (!confirm("이 계좌를 삭제할까요?")) return;
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) return alert("삭제 실패: " + error.message);
    load();
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">계좌관리</h1>
        <div className="spacer" />
        {TYPES.map((t) => (
          <button key={t} className="btn" onClick={() => openNew(t)}>
            + {TYPE_LABEL[t]} 추가
          </button>
        ))}
      </div>

      {TYPES.map((type) => {
        const list = rows.filter((r) => r.type === type);
        const fields = FIELD_DEFS[type];
        return (
          <div className="panel" key={type}>
            <h3>{TYPE_LABEL[type]} ({list.length})</h3>
            <table className="table">
              <thead>
                <tr>
                  {fields.map((f) => (
                    <th key={f.key} className={f.money ? "r" : undefined}>{f.label}</th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr><td colSpan={fields.length + 1} className="empty">등록된 {TYPE_LABEL[type]}이(가) 없습니다.</td></tr>
                )}
                {list.map((r) => (
                  <tr key={r.id}>
                    {fields.map((f) => (
                      <td key={f.key} className={f.money ? "r" : f.key === "memo" ? "muted" : undefined}>
                        {display(f, r[f.key])}
                      </td>
                    ))}
                    <td className="r" style={{ whiteSpace: "nowrap" }}>
                      <button className="btn sm" onClick={() => openEdit(r)}>수정</button>{" "}
                      <button className="btn sm danger" onClick={() => remove(r.id)}>삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {modal && (
        <Modal title={`${TYPE_LABEL[modal.type]} ${modal.mode === "new" ? "추가" : "수정"}`} onClose={() => setModal(null)}>
          {FIELD_DEFS[modal.type].map((f) => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              <input
                className={`input ${f.money ? "r" : ""}`}
                type={f.type ?? "text"}
                value={modal.form[f.key]}
                onChange={(e) => setForm({ [f.key]: e.target.value })}
              />
            </div>
          ))}
          <div className="modal-actions">
            <button className="btn" onClick={() => setModal(null)}>취소</button>
            <button className="btn primary" onClick={save} disabled={busy}>
              {modal.mode === "new" ? "추가" : "저장"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
