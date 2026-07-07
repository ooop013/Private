import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function Discounts({ user }) {
  const [rows, setRows] = useState([]);
  const [label, setLabel] = useState("");
  const [percent, setPercent] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("discount_options").select("*").order("percent");
    setRows(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!label.trim() || percent === "") return alert("이름과 할인율을 입력하세요.");
    const { error } = await supabase
      .from("discount_options")
      .insert({ user_id: user.id, label: label.trim(), percent: Number(percent) });
    if (error) return alert("추가 실패: " + error.message);
    setLabel("");
    setPercent("");
    load();
  }
  async function updatePercent(r, value) {
    const percent = Number(value);
    if (Number.isNaN(percent) || percent === Number(r.percent)) return;
    await supabase.from("discount_options").update({ percent }).eq("id", r.id);
    load();
  }
  async function rename(r) {
    const label = prompt("이름 수정", r.label)?.trim();
    if (!label || label === r.label) return;
    await supabase.from("discount_options").update({ label }).eq("id", r.id);
    load();
  }
  async function remove(r) {
    if (!confirm(`'${r.label}' 할인 옵션을 삭제할까요?`)) return;
    await supabase.from("discount_options").delete().eq("id", r.id);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">할인율 옵션 관리</h1>
      </div>
      <div className="panel">
        <div className="hint" style={{ marginBottom: 14 }}>
          견적 작성 화면에는 ‘없음(0%)’이 항상 기본으로 표시되고, 아래 등록한 옵션이 그 뒤에 추가됩니다.
        </div>
        <table className="table">
          <thead><tr><th>이름</th><th className="r">할인율(%)</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={3} className="empty">등록된 할인 옵션이 없습니다.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><span className="chip" onClick={() => rename(r)}>{r.label}</span></td>
                <td className="r">
                  <input
                    key={r.percent}
                    className="input sm r"
                    type="number"
                    defaultValue={r.percent}
                    onBlur={(e) => updatePercent(r, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                  />
                </td>
                <td className="r"><button className="btn sm danger" onClick={() => remove(r)}>삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input className="input" placeholder="이름 (예: 10%)" value={label}
            onChange={(e) => setLabel(e.target.value)} />
          <input className="input r" style={{ width: 120 }} type="number" placeholder="할인율"
            value={percent} onChange={(e) => setPercent(e.target.value)} />
          <button className="btn primary" onClick={add}>추가</button>
        </div>
      </div>
    </div>
  );
}
