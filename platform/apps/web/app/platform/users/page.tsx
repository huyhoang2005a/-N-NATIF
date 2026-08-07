"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MeResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../../lib/api-client";
import { PLATFORM_ROLE_LABELS } from "../../../lib/labels";
import { navForPersona } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { SoonPage } from "../../../components/ui";

export default function AdminUsersPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    authFetch<MeResponse>("/me")
      .then((meResponse) => {
        if (meResponse.platformRole !== "PLATFORM_ADMIN") {
          router.push("/dashboard");
          return;
        }
        setMe(meResponse);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) router.push("/login");
      });
  }, [router]);

  if (!me) return null;

  return (
    <SoonPage
      title="Người dùng"
      description="Danh mục toàn bộ người dùng trên nền tảng đang được phát triển — hiện chưa có endpoint tra cứu người dùng khác ngoài chính bạn."
      me={me}
      roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole}
      nav={navForPersona("platform-ops", true)}
    />
  );
}
