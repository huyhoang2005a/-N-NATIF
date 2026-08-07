"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MeResponse, OrganizationResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { PLATFORM_ROLE_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { SoonPage } from "../../components/ui";

export default function NotificationsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    Promise.all([authFetch<MeResponse>("/me"), authFetch<OrganizationResponse[]>("/organizations")])
      .then(([meResponse, orgs]) => {
        setMe(meResponse);
        setOrganizations(orgs);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) router.push("/login");
      });
  }, [router]);

  if (!me || !organizations) return null;

  return (
    <SoonPage
      title="Thông báo"
      description="Trung tâm thông báo hoạt động (đánh giá được duyệt, đề xuất mới...) đang được phát triển."
      me={me}
      roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole}
      nav={navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN")}
    />
  );
}
