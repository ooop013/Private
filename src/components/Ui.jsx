import { shiftDay, shiftMonth } from "../lib/utils";

export function Modal({ title, children, wide }) {
  return (
    <div className="overlay">
      <div className="modal" style={wide ? { width: 560 } : undefined}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function MonthNav({ ym, onChange }) {
  return (
    <div className="month-nav">
      <button onClick={() => onChange(shiftMonth(ym, -1))}>‹</button>
      <span className="ym">{ym}</span>
      <button onClick={() => onChange(shiftMonth(ym, 1))}>›</button>
    </div>
  );
}

export function DayNav({ date, onChange }) {
  return (
    <div className="month-nav">
      <button onClick={() => onChange(shiftDay(date, -1))}>‹</button>
      <input
        className="input"
        type="date"
        style={{ width: 150, textAlign: "center", fontWeight: 700 }}
        value={date}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
      <button onClick={() => onChange(shiftDay(date, 1))}>›</button>
    </div>
  );
}
