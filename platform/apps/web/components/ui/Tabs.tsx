export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="uikit-tabs">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`uikit-tab ${active === t ? "uikit-tab--active" : ""}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
