import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

function MenuTable({ title, table, rows, onChange }) {
  const [newName, setNewName] = useState("");

  async function add() {
    const name = newName.trim();
    if (!name) return;
    const { error } = await supabase.from(table).insert({ user_id: rows.userId, name, price: 0 });
    if (error) return alert("추가 실패: " + error.message);
    setNewName("");
    onChange();
  }
  async function rename(r) {
    const name = prompt("이름 수정", r.name)?.trim();
    if (!name || name === r.name) return;
    await supabase.from(table).update({ name }).eq("id", r.id);
    onChange();
  }
  async function updatePrice(r, value) {
    const price = Number(value);
    if (Number.isNaN(price) || price === Number(r.price)) return;
    await supabase.from(table).update({ price }).eq("id", r.id);
    onChange();
  }
  async function remove(r) {
    if (!confirm(`'${r.name}'을(를) 삭제할까요?`)) return;
    await supabase.from(table).delete().eq("id", r.id);
    onChange();
  }

  return (
    <div className="panel">
      <h3>{title}</h3>
      <table className="table">
        <thead><tr><th>이름</th><th className="r">금액</th><th></th></tr></thead>
        <tbody>
          {rows.list.length === 0 && (
            <tr><td colSpan={3} className="empty">등록된 항목이 없습니다.</td></tr>
          )}
          {rows.list.map((r) => (
            <tr key={r.id}>
              <td>
                <span className="chip" onClick={() => rename(r)}>{r.name}</span>
              </td>
              <td className="r">
                <input
                  key={r.price}
                  className="input sm r"
                  type="number"
                  defaultValue={r.price}
                  onBlur={(e) => updatePrice(r, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                />
              </td>
              <td className="r"><button className="btn sm danger" onClick={() => remove(r)}>삭제</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input className="input" placeholder="새 항목 이름"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn primary" onClick={add}>추가</button>
      </div>
    </div>
  );
}

export default function Menus({ user }) {
  const [baseMenus, setBaseMenus] = useState([]);
  const [addonMenus, setAddonMenus] = useState([]);

  const load = useCallback(async () => {
    const [b, a] = await Promise.all([
      supabase.from("base_menus").select("*").order("created_at"),
      supabase.from("addon_menus").select("*").order("created_at"),
    ]);
    setBaseMenus(b.data ?? []);
    setAddonMenus(a.data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">기본/추가메뉴 관리</h1>
      </div>
      <MenuTable title="기본메뉴 (단일 선택)" table="base_menus"
        rows={{ list: baseMenus, userId: user.id }} onChange={load} />
      <MenuTable title="추가메뉴 (다중 선택)" table="addon_menus"
        rows={{ list: addonMenus, userId: user.id }} onChange={load} />
    </div>
  );
}
