import { useState } from "react";
import Builder from "./quote/Builder";
import PriceAdmin from "./quote/PriceAdmin";

const SUB_TABS = [
  { key: "builder", label: "견적 작성" },
  { key: "admin", label: "가격표 관리" },
];

export default function Quote({ user }) {
  const [sub, setSub] = useState("builder");

  return (
    <div className="page">
      <div className="subtabs">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            className={`subtab ${sub === t.key ? "active" : ""}`}
            onClick={() => setSub(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === "builder" && <Builder user={user} />}
      {sub === "admin" && <PriceAdmin user={user} />}
    </div>
  );
}
