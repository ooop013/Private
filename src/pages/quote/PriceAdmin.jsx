import { useState } from "react";
import Rules from "./admin/Rules";
import Parts from "./admin/Parts";
import Menus from "./admin/Menus";
import Discounts from "./admin/Discounts";

const TABS = [
  { key: "rules", label: "가격규칙" },
  { key: "parts", label: "파츠" },
  { key: "menus", label: "기본/추가메뉴" },
  { key: "discounts", label: "할인율" },
];

export default function PriceAdmin({ user }) {
  const [tab, setTab] = useState("rules");

  return (
    <div>
      <div className="subtabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`subtab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "rules" && <Rules user={user} />}
      {tab === "parts" && <Parts user={user} />}
      {tab === "menus" && <Menus user={user} />}
      {tab === "discounts" && <Discounts user={user} />}
    </div>
  );
}
