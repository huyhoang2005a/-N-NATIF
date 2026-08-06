interface TimelineStep {
  id: string;
  label: string;
  status: string;
}

function stepModifier(status: string): string {
  if (status === "COMPLETED") return "rm-step--done";
  if (status === "IN_PROGRESS") return "rm-step--current";
  if (status === "BLOCKED") return "rm-step--blocked";
  return "";
}

/** Mini-timeline cho roadmap milestone — thấy được thứ tự, không cần phức tạp như
 * Gantt chart đầy đủ. Không tự vẽ lại quan hệ dependency (xem trang roadmap chi tiết
 * cho bảng phụ thuộc đầy đủ), chỉ thể hiện tiến độ tuần tự theo `sortOrder`. */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="rm-timeline">
      {steps.map((step, index) => (
        <div key={step.id} style={{ display: "contents" }}>
          <div className={["rm-step", stepModifier(step.status)].filter(Boolean).join(" ")}>
            <span className="rm-step__dot" />
            <span className="rm-step__label">{step.label}</span>
          </div>
          {index < steps.length - 1 && (
            <div className={["rm-connector", step.status === "COMPLETED" ? "rm-connector--done" : ""].filter(Boolean).join(" ")} />
          )}
        </div>
      ))}
    </div>
  );
}
