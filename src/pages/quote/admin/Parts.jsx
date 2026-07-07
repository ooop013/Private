import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Modal } from "../../../components/Ui";

const EMPTY = { name: "", rule_id: "", file: null };

export default function Parts({ user }) {
  const [parts, setParts] = useState([]);
  const [rules, setRules] = useState([]);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, r] = await Promise.all([
      supabase.from("parts").select("*").order("created_at", { ascending: false }),
      supabase.from("price_rules").select("*").order("created_at"),
    ]);
    setParts(p.data ?? []);
    setRules(r.data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }));

  async function uploadImage(file) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("parts").upload(path, file);
    if (error) throw new Error("사진 업로드 실패: " + error.message);
    return supabase.storage.from("parts").getPublicUrl(path).data.publicUrl;
  }

  async function save() {
    const f = modal.form;
    if (!f.name.trim()) return alert("파츠 이름을 입력하세요.");
    setBusy(true);
    try {
      let image_url = modal.image_url ?? null;
      if (f.file) image_url = await uploadImage(f.file);
      const payload = { name: f.name.trim(), rule_id: f.rule_id || null, image_url };
      const q =
        modal.mode === "new"
          ? supabase.from("parts").insert({ ...payload, user_id: user.id })
          : supabase.from("parts").update(payload).eq("id", modal.id);
      const { error } = await q;
      if (error) throw new Error("저장 실패: " + error.message);
      setModal(null);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(p) {
    if (!confirm(`'${p.name}' 파츠를 삭제할까요?`)) return;
    await supabase.from("parts").delete().eq("id", p.id);
    load();
  }

  async function changeRule(p, ruleId) {
    await supabase.from("parts").update({ rule_id: ruleId || null }).eq("id", p.id);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">파츠 관리</h1>
        <div className="spacer" />
        <button
          className="btn primary"
          onClick={() => setModal({ mode: "new", form: { ...EMPTY } })}
        >
          + 파츠 등록
        </button>
      </div>

      <div className="panel">
        {rules.length === 0 && (
          <div className="hint" style={{ marginBottom: 14 }}>
            아직 등록된 가격규칙이 없습니다. ‘가격규칙 관리’에서 먼저 규칙을 만드세요.
          </div>
        )}
        <div className="part-grid">
          {parts.length === 0 && <span className="chip-empty">등록된 파츠가 없습니다.</span>}
          {parts.map((p) => (
            <div className="part-admin-card" key={p.id}>
              {p.image_url
                ? <img src={p.image_url} alt={p.name} />
                : <div className="part-noimg">사진 없음</div>}
              <div className="name">{p.name}</div>
              <select
                className="input sm"
                value={p.rule_id ?? ""}
                onChange={(e) => changeRule(p, e.target.value)}
              >
                <option value="">규칙 미지정</option>
                {rules.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button className="btn sm" onClick={() => setModal({
                  mode: "edit", id: p.id, image_url: p.image_url,
                  form: { name: p.name, rule_id: p.rule_id ?? "", file: null },
                })}>수정</button>
                <button className="btn sm danger" onClick={() => remove(p)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <Modal title={modal.mode === "new" ? "파츠 등록" : "파츠 수정"} onClose={() => setModal(null)}>
          <div className="field">
            <label>파츠 이름</label>
            <input className="input" value={modal.form.name}
              onChange={(e) => setForm({ name: e.target.value })} placeholder="예: 리본A" />
          </div>
          <div className="field">
            <label>적용 규칙</label>
            <select className="input" value={modal.form.rule_id}
              onChange={(e) => setForm({ rule_id: e.target.value })}>
              <option value="">규칙 미지정</option>
              {rules.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>사진</label>
            <input className="input" type="file" accept="image/*"
              onChange={(e) => setForm({ file: e.target.files?.[0] ?? null })} />
            {modal.image_url && !modal.form.file && (
              <div className="hint">기존 사진 있음 — 새 파일을 선택하면 교체됩니다.</div>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setModal(null)}>취소</button>
            <button className="btn primary" onClick={save} disabled={busy}>
              {busy ? "저장 중…" : modal.mode === "new" ? "등록" : "저장"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
