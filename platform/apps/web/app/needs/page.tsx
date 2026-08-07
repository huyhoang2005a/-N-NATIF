"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MeResponse, OrganizationResponse } from "@r2m/contracts";
import { authFetch, SessionExpiredError } from "../../lib/api-client";
import { PLATFORM_ROLE_LABELS } from "../../lib/labels";
import { navForPersona, personaOf } from "../../lib/nav";
import { getAccessToken } from "../../lib/session";
import { SoonPage } from "../../components/ui";

export default function NeedsPage() {
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

  const persona = personaOf(me, organizations);

  return (
    <SoonPage
      title="Nhu cầu nghiên cứu"
      description="Tính năng đăng nhu cầu nghiên cứu và nhận đề xuất từ tác giả đang được phát triển (Phase 5)."
      me={me}
      roleLabel={PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole}
      nav={navForPersona(persona, me.platformRole === "PLATFORM_ADMIN")}
    />
  );
}
