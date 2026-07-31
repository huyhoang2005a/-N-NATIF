export const OrganizationType = {
  RESEARCH_UNIT: "RESEARCH_UNIT",
  ENTERPRISE: "ENTERPRISE",
  GOVERNMENT: "GOVERNMENT",
  SUPPORT_ORGANIZATION: "SUPPORT_ORGANIZATION",
} as const;
export type OrganizationType = (typeof OrganizationType)[keyof typeof OrganizationType];

export const OrganizationStatus = {
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  ACTIVE: "ACTIVE",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED",
  ARCHIVED: "ARCHIVED",
} as const;
export type OrganizationStatus = (typeof OrganizationStatus)[keyof typeof OrganizationStatus];

export const OrganizationMemberRole = {
  ORG_OWNER: "ORG_OWNER",
  ORG_ADMIN: "ORG_ADMIN",
  MEMBER: "MEMBER",
} as const;
export type OrganizationMemberRole = (typeof OrganizationMemberRole)[keyof typeof OrganizationMemberRole];

export const MembershipStatus = {
  INVITED: "INVITED",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  LEFT: "LEFT",
} as const;
export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];
