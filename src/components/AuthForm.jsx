import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthForm() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    setInfo("");
    setBusy(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("로그인 실패: 이메일 또는 비밀번호를 확인하세요.");
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError("회원가입 실패: " + error.message);
      else setInfo("가입 완료. 확인 메일이 발송된 경우 메일 인증 후 로그인하세요.");
    }
    setBusy(false);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <h1>매출관리</h1>
        <p>{mode === "login" ? "계정으로 로그인하세요" : "새 계정을 만드세요"}</p>
        <div className="field">
          <label>이메일</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="field">
          <label>비밀번호</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="6자 이상"
          />
        </div>
        <button className="btn primary" style={{ width: "100%" }} onClick={submit} disabled={busy}>
          {mode === "login" ? "로그인" : "회원가입"}
        </button>
        {error && <div className="auth-error">{error}</div>}
        {info && <div className="field hint" style={{ marginTop: 10 }}>{info}</div>}
        <div className="auth-switch">
          {mode === "login" ? (
            <>계정이 없나요? <button onClick={() => setMode("signup")}>회원가입</button></>
          ) : (
            <>이미 계정이 있나요? <button onClick={() => setMode("login")}>로그인</button></>
          )}
        </div>
      </div>
    </div>
  );
}
