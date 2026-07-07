import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Modal, MonthNav } from "../components/Ui";
import { monthRange, thisMonth, today, won } from "../lib/utils";

const EMPTY = { expense_date: "", category: "", amount: "", memo: "", file: null };

export default function Materials({ user }) {
  const [ym, setYm] = useState(thisMonth());
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [modal, setModal] = useState(null);
  const [catModal, setCatModal] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState({ from: monthRange(thisMonth()).start, to: today() });
  const [dlBusy, setDlBusy] = useState(false);

  const loadCats = useCallback(async () => {
    const { data } = await supabase
      .from("material_categories")
      .select("*")
      .order("created_at");
    setCats(data ?? []);
  }, []);

  const load = useCallback(async () => {
    const { start, end } = monthRange(ym);
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("kind", "material")
      .gte("expense_date", start)
      .lt("expense_date", end)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  }, [ym]);

  useEffect(() => { load(); loadCats(); }, [load, loadCats]);

  const total = useMemo(() => rows.reduce((a, r) => a + Number(r.amount), 0), [rows]);
  const setForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }));

  // ── CSV 다운로드 ──────────────────────
  async function downloadCsv() {
    if (!range.from || !range.to) return alert("기간을 선택하세요.");
    if (range.from > range.to) return alert("시작일이 종료일보다 늦을 수 없습니다.");
    setDlBusy(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("kind", "material")
      .gte("expense_date", range.from)
      .lte("expense_date", range.to)
      .order("expense_date", { ascending: true });
    setDlBusy(false);
    if (error) return alert("다운로드 실패: " + error.message);
    if (!data || data.length === 0) return alert("해당 기간에 재료비 내역이 없습니다.");

    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["날짜", "품목", "메모", "금액"].map(esc).join(","),
      ...data.map((r) => [r.expense_date, r.category, r.memo, r.amount].map(esc).join(",")),
    ];
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `재료비_${range.from}_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── 카테고리 관리 ──────────────────────
  async function addCat() {
    const name = newCat.trim();
    if (!name) return;
    if (cats.some((c) => c.name === name)) return alert("이미 있는 카테고리입니다.");
    const { error } = await supabase
      .from("material_categories")
      .insert({ user_id: user.id, name });
    if (error) return alert("추가 실패: " + error.message);
    setNewCat("");
    loadCats();
  }
  async function renameCat(c) {
    const name = prompt("카테고리 이름 수정", c.name)?.trim();
    if (!name || name === c.name) return;
    const { error } = await supabase
      .from("material_categories")
      .update({ name })
      .eq("id", c.id);
    if (error) return alert("수정 실패: " + error.message);
    loadCats();
  }
  async function removeCat(c) {
    if (!confirm(`'${c.name}' 카테고리를 삭제할까요?\n(기존 등록 건의 품목명은 유지됩니다)`)) return;
    await supabase.from("material_categories").delete().eq("id", c.id);
    loadCats();
  }

  // ── 영수증 ────────────────────────────
  async function uploadReceipt(file) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("receipts").upload(path, file);
    if (error) throw new Error("영수증 업로드 실패: " + error.message);
    return path;
  }
  async function viewReceipt(path) {
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(path, 600);
    if (error || !data?.signedUrl) return alert("영수증을 불러오지 못했습니다.");
    window.open(data.signedUrl, "_blank");
  }

  // ── 저장/삭제 ─────────────────────────
  async function save() {
    const f = modal.form;
    if (!f.expense_date || !f.amount) return alert("날짜와 금액을 입력하세요.");
    if (!f.category) return alert("품목(카테고리)을 선택하세요.");
    setBusy(true);
    try {
      let receipt_path = modal.receipt_path ?? null;
      if (f.file) receipt_path = await uploadReceipt(f.file);
      const payload = {
        expense_date: f.expense_date,
        amount: Number(f.amount),
        category: f.category,
        memo: f.memo || null,
        kind: "material",
        receipt_path,
      };
      const q =
        modal.mode === "new"
          ? supabase.from("expenses").insert({ ...payload, user_id: user.id })
          : supabase.from("expenses").update(payload).eq("id", modal.id);
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

  async function remove(r) {
    if (!confirm("삭제할까요?")) return;
    await supabase.from("expenses").delete().eq("id", r.id);
    if (r.receipt_path) await supabase.storage.from("receipts").remove([r.receipt_path]);
    load();
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">재료비관리</h1>
        <MonthNav ym={ym} onChange={setYm} />
        <div className="spacer" />
        <div className="range-picker">
          <input
            className="input sm"
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
          <span>~</span>
          <input
            className="input sm"
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
          <button className="btn" onClick={downloadCsv} disabled={dlBusy}>
            {dlBusy ? "다운로드 중…" : "CSV 다운로드"}
          </button>
        </div>
        <button className="btn" onClick={() => setCatModal(true)}>카테고리 관리</button>
        <button
          className="btn primary"
          onClick={() =>
            setModal({ mode: "new", form: { ...EMPTY, expense_date: today() } })
          }
        >
          + 재료비 등록
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">{ym} 재료비 합계</div>
          <div className="value">{won(total)}</div>
          <div className="sub">{rows.length}건</div>
        </div>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>날짜</th><th>품목</th><th>메모</th><th className="r">금액</th><th>영수증</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="empty">등록된 재료비가 없습니다.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.expense_date}</td>
                <td><span className="badge done">{r.category}</span></td>
                <td className="muted">{r.memo}</td>
                <td className="r">{won(r.amount)}</td>
                <td>
                  {r.receipt_path ? (
                    <button className="btn sm" onClick={() => viewReceipt(r.receipt_path)}>보기</button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="r" style={{ whiteSpace: "nowrap" }}>
                  <button
                    className="btn sm"
                    onClick={() =>
                      setModal({
                        mode: "edit",
                        id: r.id,
                        receipt_path: r.receipt_path,
                        form: {
                          expense_date: r.expense_date,
                          category: r.category ?? "",
                          amount: String(r.amount),
                          memo: r.memo ?? "",
                          file: null,
                        },
                      })
                    }
                  >
                    수정
                  </button>{" "}
                  <button className="btn sm danger" onClick={() => remove(r)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 카테고리 관리 모달 */}
      {catModal && (
        <Modal title="재료비 카테고리 관리" onClose={() => setCatModal(false)}>
          <div className="field">
            <label>새 카테고리 추가</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" placeholder="예: 원두, 유제품, 포장재"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCat()} />
              <button className="btn primary" onClick={addCat}>추가</button>
            </div>
          </div>
          <div className="subhead">카테고리 (클릭=이름 수정, ×=삭제)</div>
          <div className="chip-row">
            {cats.length === 0 && <span className="chip-empty">아직 카테고리가 없습니다.</span>}
            {cats.map((c) => (
              <span key={c.id} className="chip" onClick={() => renameCat(c)}>
                {c.name}
                <button className="x" onClick={(e) => { e.stopPropagation(); removeCat(c); }}>×</button>
              </span>
            ))}
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setCatModal(false)}>닫기</button>
          </div>
        </Modal>
      )}

      {/* 등록/수정 모달 */}
      {modal && (
        <Modal title={modal.mode === "new" ? "재료비 등록" : "재료비 수정"} onClose={() => setModal(null)}>
          <div className="field">
            <label>날짜</label>
            <input className="input" type="date" value={modal.form.expense_date}
              onChange={(e) => setForm({ expense_date: e.target.value })} />
          </div>
          <div className="field">
            <label>품목 (카테고리)</label>
            <div className="chip-row">
              {cats.length === 0 && (
                <span className="chip-empty">‘카테고리 관리’에서 먼저 추가하세요.</span>
              )}
              {cats.map((c) => (
                <span key={c.id}
                  className={`chip ${modal.form.category === c.name ? "on" : ""}`}
                  onClick={() => setForm({ category: c.name })}>
                  {c.name}
                </span>
              ))}
            </div>
          </div>
          <div className="field">
            <label>금액</label>
            <input className="input r" type="number" value={modal.form.amount}
              onChange={(e) => setForm({ amount: e.target.value })} />
          </div>
          <div className="field">
            <label>메모 (선택)</label>
            <input className="input" placeholder="예: ○○상사, 원두 5kg" value={modal.form.memo}
              onChange={(e) => setForm({ memo: e.target.value })} />
          </div>
          <div className="field">
            <label>영수증 사진 (선택)</label>
            <input className="input" type="file" accept="image/*"
              onChange={(e) => setForm({ file: e.target.files?.[0] ?? null })} />
            {modal.receipt_path && !modal.form.file && (
              <div className="hint">기존 영수증 있음 — 새 파일을 선택하면 교체됩니다.</div>
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
