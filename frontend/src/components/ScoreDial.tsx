type ScoreDialProps = {
  label: string;
  value: number;
};

export function ScoreDial({ label, value }: ScoreDialProps) {
  const bounded = Math.max(0, Math.min(value, 100));
  const tone = bounded >= 80 ? "var(--success)" : bounded >= 60 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="dial">
      <div
        className="dial__ring"
        style={{
          background: `conic-gradient(${tone} 0 ${bounded * 3.6}deg, rgba(255,255,255,0.08) ${bounded * 3.6}deg 360deg)`,
        }}
      >
        <div className="dial__core">
          <strong>{bounded}</strong>
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}
