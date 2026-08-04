export interface StepperStep {
  label: string;
  description: string;
}

export const REGISTRY_STEPS: StepperStep[] = [
  { label: "Nộp hồ sơ", description: "Khai báo thông tin tổ chức và người đại diện." },
  { label: "Đang xét duyệt", description: "Chuyên viên thẩm định kiểm tra tính xác thực của hồ sơ." },
  { label: "Đã xác minh", description: "Tổ chức được cấp quyền hoạt động đầy đủ trên R2M." },
];

/** `current` is the zero-based index of the step the organization is on right now. */
export function RegistryStepper({ steps = REGISTRY_STEPS, current }: { steps?: StepperStep[]; current: number }) {
  return (
    <ol className="stepper">
      {steps.map((step, index) => {
        const state = index < current ? "done" : index === current ? "current" : "upcoming";
        return (
          <li key={step.label} className={`stepper__item stepper__item--${state}`}>
            <div className="stepper__rail">
              <span className="stepper__dot">{state === "done" ? "✓" : index + 1}</span>
              {index < steps.length - 1 && <span className="stepper__line" />}
            </div>
            <div>
              <p className="stepper__label">{step.label}</p>
              <p className="stepper__desc">{step.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
