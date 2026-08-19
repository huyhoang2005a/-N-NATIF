import { ShieldCheck } from "lucide-react";
import { Card } from "./Card";
import { PrimaryButtonLink } from "./PrimaryButton";

/**
 * Blocked-state card shown in place of an author-only form (đăng tài nguyên / tạo
 * technology case / gửi đề xuất...) when `me.authorVerificationStatus !== "VERIFIED"`.
 * Defense in depth: the backend already 403s these actions
 * (RESOURCE_AUTHOR_NOT_VERIFIED / CASE_CREATOR_NOT_VERIFIED_AUTHOR /
 * DISCOVERY_AUTHOR_NOT_VERIFIED) — this just stops the user from ever reaching a form
 * that's guaranteed to fail on submit. Visual convention borrowed from `SoonPage`
 * (`.uikit-soon*` classes) but this is a call to action, not a "not built yet" notice.
 */
export function AuthorVerificationGate({ message }: { message?: string }) {
  return (
    <Card>
      <div className="uikit-soon">
        <div className="uikit-soon__icon">
          <ShieldCheck aria-hidden="true" />
        </div>
        <p className="uikit-soon__title">Cần xác minh tác giả</p>
        <p>{message ?? "Bạn cần được xác minh là tác giả để dùng tính năng này."}</p>
        <PrimaryButtonLink href="/profile" className="uikit-mt-4">
          Xác minh ngay
        </PrimaryButtonLink>
      </div>
    </Card>
  );
}
