import { useState } from "react";
import Accounts from "./ledger/Accounts";
import Transactions from "./ledger/Transactions";

const SUB_TABS = [
  { key: "transactions", label: "지출내역" },
  { key: "accounts", label: "계좌관리" },
];

export default function Ledger({ user }) {
  const [sub, setSub] = useState("transactions");

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

      {sub === "accounts" && <Accounts user={user} />}
      {sub === "transactions" && <Transactions user={user} />}
    </div>
  );
}
