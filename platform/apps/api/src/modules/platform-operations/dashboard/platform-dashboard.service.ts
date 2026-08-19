import type { PlatformDashboardMonthlyPoint, PlatformDashboardResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertPlatformAdmin } from "@r2m/authz";
import { Injectable } from "@nestjs/common";
import { zeroFillMonthly } from "../../../common/stats/month-buckets.util";
import { PlatformDashboardRepository } from "./platform-dashboard.repository";

const ZERO_COUNTS = { count: 0 };

function toSeries(rows: { month: string; count: number }[]): Map<string, number> {
  return new Map(zeroFillMonthly(rows, ZERO_COUNTS).map((row) => [row.month, row.count]));
}

@Injectable()
export class PlatformDashboardService {
  constructor(private readonly repository: PlatformDashboardRepository) {}

  async getDashboard(actor: ActorContext): Promise<PlatformDashboardResponse> {
    assertPlatformAdmin(actor);

    const [users, organizations, cases, resources, approved, rejected] = await Promise.all([
      this.repository.newUsersByMonth(),
      this.repository.newOrganizationsByMonth(),
      this.repository.newTechnologyCasesByMonth(),
      this.repository.newResourcesByMonth(),
      this.repository.verificationDecisionsByMonth("APPROVED"),
      this.repository.verificationDecisionsByMonth("REJECTED"),
    ]);

    const usersByMonth = toSeries(users);
    const orgsByMonth = toSeries(organizations);
    const casesByMonth = toSeries(cases);
    const resourcesByMonth = toSeries(resources);
    const approvedByMonth = toSeries(approved);
    const rejectedByMonth = toSeries(rejected);

    const monthly: PlatformDashboardMonthlyPoint[] = [...usersByMonth.keys()].map((month) => ({
      month,
      newUsers: usersByMonth.get(month) ?? 0,
      newOrganizations: orgsByMonth.get(month) ?? 0,
      newTechnologyCases: casesByMonth.get(month) ?? 0,
      newResources: resourcesByMonth.get(month) ?? 0,
      verificationsApproved: approvedByMonth.get(month) ?? 0,
      verificationsRejected: rejectedByMonth.get(month) ?? 0,
    }));

    return { monthly };
  }
}
