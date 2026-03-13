type ScoreBarProps = {
  label: string;
  value: number;
};

export function ScoreBar({ label, value }: ScoreBarProps) {
  return (
    <div className="scorebar">
      <div className="scorebar__meta">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="scorebar__track">
        <div className="scorebar__fill" style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
      </div>
    </div>
  );
}
