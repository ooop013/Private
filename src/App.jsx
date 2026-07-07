import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import AuthForm from "./components/AuthForm";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Materials from "./pages/Materials";
import Ledger from "./pages/Ledger";

const TABS = [
  { key: "home", label: "홈" },
  { key: "sales", label: "매출관리" },
  { key: "materials", label: "재료비관리" },
  { key: "ledger", label: "가계부" },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return null;
  if (!session) return <AuthForm />;

  const user = session.user;

  return (
    <>
      <header className="app-header">
        <div className="brand">
          매출관리<small>사업 장부</small>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <span>{user.email}</span>
          <button className="btn sm" onClick={() => supabase.auth.signOut()}>
            로그아웃
          </button>
        </div>
      </header>

      {tab === "home" && <Dashboard user={user} />}
      {tab === "sales" && <Sales user={user} />}
      {tab === "materials" && <Materials user={user} />}
      {tab === "ledger" && <Ledger user={user} />}
    </>
  );
}
