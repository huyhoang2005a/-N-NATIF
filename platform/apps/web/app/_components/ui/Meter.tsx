/** Thanh đo điểm (composite score, match %...) — giá trị 0-100. */
export function Meter({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="ui-meter" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className="ui-meter__fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}
