"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import type { MeResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../../lib/api-client";
import { PLATFORM_ROLE_LABELS } from "../../../lib/labels";
import { navForPersona } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { SoonPage } from "../../../components/ui";

export default function AdminOrganizationsPage() {
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
      title="Tổ chức"
      description="Danh mục toàn bộ tổ chức trên nền tảng đang được phát triển — API hiện chỉ trả về tổ chức bạn là thành viên, chưa có endpoint liệt kê tất cả."
      icon={Building2}
      me={me}
      roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole}
      nav={navForPersona("platform-ops", true)}
    />
  );
}
