import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function Rules({ user }) {
  const [rules, setRules] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [newRuleName, setNewRuleName] = useState("");
  const [newTier, setNewTier] = useState({}); // { [ruleId]: { qty, price } }

  const load = useCallback(async () => {
    const [r, t] = await Promise.all([
      supabase.from("price_rules").select("*").order("created_at"),
      supabase.from("price_rule_tiers").select("*").order("qty"),
    ]);
    setRules(r.data ?? []);
    setTiers(t.data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addRule() {
    const name = newRuleName.trim();
    if (!name) return;
    const { error } = await supabase.from("price_rules").insert({ user_id: user.id, name });
    if (error) return alert("추가 실패: " + error.message);
    setNewRuleName("");
    load();
  }
  async function renameRule(r) {
    const name = prompt("규칙 이름 수정", r.name)?.trim();
    if (!name || name === r.name) return;
    await supabase.from("price_rules").update({ name }).eq("id", r.id);
    load();
  }
  async function removeRule(r) {
    if (!confirm(`'${r.name}' 규칙을 삭제할까요?\n연결된 수량-금액 티어도 함께 삭제되고, 이 규칙을 쓰던 파츠는 규칙 미지정 상태가 됩니다.`)) return;
    await supabase.from("price_rules").delete().eq("id", r.id);
    load();
  }

  async function addTier(ruleId) {
    const t = newTier[ruleId] ?? {};
    if (!t.qty || !t.price) return alert("수량과 금액을 입력하세요.");
    const { error } = await supabase.from("price_rule_tiers").insert({
      user_id: user.id, rule_id: ruleId, qty: Number(t.qty), price: Number(t.price),
    });
    if (error) return alert("이미 등록된 수량이거나 저장에 실패했습니다: " + error.message);
    setNewTier((s) => ({ ...s, [ruleId]: { qty: "", price: "" } }));
    load();
  }
  async function updateTierPrice(t, value) {
    const price = Number(value);
    if (Number.isNaN(price) || price === Number(t.price)) return;
    await supabase.from("price_rule_tiers").update({ price }).eq("id", t.id);
    load();
  }
  async function removeTier(t) {
    if (!confirm(`${t.qty}개 티어를 삭제할까요?`)) return;
    await supabase.from("price_rule_tiers").delete().eq("id", t.id);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">가격규칙 관리</h1>
        <div className="spacer" />
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" placeholder="새 규칙 이름 (예: 대형파츠)"
            value={newRuleName}
            onChange={(e) => setNewRuleName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRule()} />
          <button className="btn primary" onClick={addRule}>규칙 추가</button>
        </div>
      </div>

      {rules.length === 0 && (
        <div className="panel"><span className="chip-empty">등록된 가격규칙이 없습니다. 위에서 추가하세요.</span></div>
      )}

      {rules.map((r) => {
        const ruleTiers = tiers.filter((t) => t.rule_id === r.id);
        const nt = newTier[r.id] ?? { qty: "", price: "" };
        return (
          <div className="panel" key={r.id}>
            <div className="panel-head">
              <h3>{r.name}</h3>
              <div>
                <button className="btn sm" onClick={() => renameRule(r)}>이름수정</button>{" "}
                <button className="btn sm danger" onClick={() => removeRule(r)}>삭제</button>
              </div>
            </div>
            <table className="table">
              <thead>
                <tr><th>수량</th><th className="r">금액</th><th></th></tr>
              </thead>
              <tbody>
                {ruleTiers.length === 0 && (
                  <tr><td colSpan={3} className="empty">등록된 티어가 없습니다.</td></tr>
                )}
                {ruleTiers.map((t) => (
                  <tr key={t.id}>
                    <td>{t.qty}개</td>
                    <td className="r">
                      <input
                        key={t.price}
                        className="input sm r"
                        type="number"
                        defaultValue={t.price}
                        onBlur={(e) => updateTierPrice(t, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                      />
                    </td>
                    <td className="r"><button className="btn sm danger" onClick={() => removeTier(t)}>삭제</button></td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <input className="input sm" type="number" placeholder="수량"
                      value={nt.qty}
                      onChange={(e) => setNewTier((s) => ({ ...s, [r.id]: { ...nt, qty: e.target.value } }))} />
                  </td>
                  <td className="r">
                    <input className="input sm r" type="number" placeholder="금액"
                      value={nt.price}
                      onChange={(e) => setNewTier((s) => ({ ...s, [r.id]: { ...nt, price: e.target.value } }))} />
                  </td>
                  <td className="r"><button className="btn sm" onClick={() => addTier(r.id)}>추가</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
