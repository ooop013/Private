import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { today, won } from "../../lib/utils";

export default function Builder({ user }) {
  const [baseMenus, setBaseMenus] = useState([]);
  const [addonMenus, setAddonMenus] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [parts, setParts] = useState([]);
  const [discountOptions, setDiscountOptions] = useState([]);

  const [selectedBase, setSelectedBase] = useState("");
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [partQty, setPartQty] = useState({});
  const [selectedDiscount, setSelectedDiscount] = useState("none");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [b, a, t, p, d] = await Promise.all([
      supabase.from("base_menus").select("*").order("created_at"),
      supabase.from("addon_menus").select("*").order("created_at"),
      supabase.from("price_rule_tiers").select("*").order("qty"),
      supabase.from("parts").select("*").order("created_at"),
      supabase.from("discount_options").select("*").order("percent"),
    ]);
    setBaseMenus(b.data ?? []);
    setAddonMenus(a.data ?? []);
    setTiers(t.data ?? []);
    setParts(p.data ?? []);
    setDiscountOptions(d.data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const tierPrice = useCallback((part, qty) => {
    if (!part.rule_id || qty <= 0) return 0;
    const t = tiers.find((x) => x.rule_id === part.rule_id && x.qty === qty);
    return t ? Number(t.price) : null; // null = 해당 수량 티어 없음
  }, [tiers]);

  function changeQty(partId, delta) {
    setPartQty((s) => ({ ...s, [partId]: Math.max(0, (s[partId] ?? 0) + delta) }));
  }
  function toggleAddon(id) {
    setSelectedAddons((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const selectedParts = useMemo(
    () => parts
      .map((p) => ({ ...p, qty: partQty[p.id] ?? 0 }))
      .filter((p) => p.qty > 0)
      .map((p) => ({ ...p, price: tierPrice(p, p.qty) })),
    [parts, partQty, tierPrice]
  );

  const baseMenu = baseMenus.find((m) => m.id === selectedBase);
  const addons = addonMenus.filter((m) => selectedAddons.includes(m.id));

  const baseAmount = Number(baseMenu?.price ?? 0);
  const addonAmount = addons.reduce((a, m) => a + Number(m.price), 0);
  const partsAmount = selectedParts.reduce((a, p) => a + (p.price ?? 0), 0);
  const subtotal = baseAmount + addonAmount + partsAmount;

  const allDiscounts = useMemo(
    () => [{ id: "none", label: "없음", percent: 0 }, ...discountOptions],
    [discountOptions]
  );
  const discount = allDiscounts.find((d) => d.id === selectedDiscount) ?? allDiscounts[0];
  const discountAmount = subtotal * (Number(discount.percent) / 100);
  const total = subtotal - discountAmount;
  const hasMissingTier = selectedParts.some((p) => p.price == null);

  function resetForm() {
    setSelectedBase("");
    setSelectedAddons([]);
    setPartQty({});
    setSelectedDiscount("none");
  }

  async function saveQuote() {
    if (!selectedBase) return alert("기본메뉴를 선택하세요.");
    setBusy(true);
    const payload = {
      user_id: user.id,
      quote_date: today(),
      base_menu: baseMenu ? { id: baseMenu.id, name: baseMenu.name, price: Number(baseMenu.price) } : null,
      addons: addons.map((m) => ({ id: m.id, name: m.name, price: Number(m.price) })),
      parts: selectedParts.map((p) => ({ id: p.id, name: p.name, qty: p.qty, price: p.price ?? 0 })),
      discount_percent: Number(discount.percent),
      total_amount: total,
    };
    const { error } = await supabase.from("quotes").insert(payload);
    setBusy(false);
    if (error) return alert("저장 실패: " + error.message);
    alert("견적이 저장되었습니다.");
    resetForm();
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">견적 작성</h1>
      </div>

      <div className="panel">
        <h3>기본메뉴</h3>
        <div className="chip-row">
          {baseMenus.length === 0 && <span className="chip-empty">등록된 기본메뉴가 없습니다. ‘가격표 관리’에서 추가하세요.</span>}
          {baseMenus.map((m) => (
            <span key={m.id}
              className={`chip ${selectedBase === m.id ? "on" : ""}`}
              onClick={() => setSelectedBase(m.id)}>
              {m.name} · {won(m.price)}
            </span>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>추가메뉴</h3>
        <div className="chip-row">
          {addonMenus.length === 0 && <span className="chip-empty">등록된 추가메뉴가 없습니다.</span>}
          {addonMenus.map((m) => (
            <span key={m.id}
              className={`chip ${selectedAddons.includes(m.id) ? "on" : ""}`}
              onClick={() => toggleAddon(m.id)}>
              {m.name} · {won(m.price)}
            </span>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>파츠 선택</h3>
        <div className="part-grid">
          {parts.length === 0 && <span className="chip-empty">등록된 파츠가 없습니다.</span>}
          {parts.map((p) => {
            const qty = partQty[p.id] ?? 0;
            const price = qty > 0 ? tierPrice(p, qty) : 0;
            return (
              <div className={`part-card ${qty > 0 ? "selected" : ""}`} key={p.id}>
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} />
                  : <div className="part-noimg">사진 없음</div>}
                <div className="name">{p.name}</div>
                <div className="qty-stepper">
                  <button onClick={() => changeQty(p.id, -1)} disabled={qty === 0}>−</button>
                  <span>{qty}</span>
                  <button onClick={() => changeQty(p.id, 1)}>+</button>
                </div>
                {qty > 0 && (
                  price == null
                    ? <div className="part-warn">이 수량 가격 규칙 없음</div>
                    : <div className="part-amt">{won(price)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <h3>할인</h3>
        <div className="chip-row">
          {allDiscounts.map((d) => (
            <span key={d.id}
              className={`chip ${selectedDiscount === d.id ? "on" : ""}`}
              onClick={() => setSelectedDiscount(d.id)}>
              {d.label}
            </span>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>견적 요약</h3>
        <div className="summary-row"><span>기본메뉴</span><span>{baseMenu ? `${baseMenu.name} · ${won(baseAmount)}` : "선택 안 함"}</span></div>
        <div className="summary-row"><span>추가메뉴</span><span>{addons.length ? `${addons.map((m) => m.name).join(", ")} · ${won(addonAmount)}` : "없음"}</span></div>
        <div className="summary-row"><span>파츠</span><span>{selectedParts.length ? `${selectedParts.map((p) => `${p.name} ${p.qty}개`).join(", ")} · ${won(partsAmount)}` : "없음"}</span></div>
        <div className="summary-row"><span>할인</span><span>{discount.label} (−{won(discountAmount)})</span></div>
        {hasMissingTier && (
          <div className="hint" style={{ color: "var(--danger)" }}>
            선택한 수량에 대한 가격 규칙이 없는 파츠가 있어 0원으로 계산됐습니다. 가격표 관리에서 티어를 추가하세요.
          </div>
        )}
        <div className="summary-total">
          <span>최종 견적 금액</span>
          <span>{won(total)}</span>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={resetForm}>초기화</button>
          <button className="btn primary" onClick={saveQuote} disabled={busy}>
            {busy ? "저장 중…" : "견적 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
