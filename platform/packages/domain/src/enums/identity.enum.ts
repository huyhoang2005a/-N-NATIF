/** Platform-level role. Never used to encode Author/Company capability — see profile/membership instead. */
export const PlatformRole = {
  USER: "USER",
  PLATFORM_REVIEWER: "PLATFORM_REVIEWER",
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
} as const;
export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

export const UserStatus = {
  INVITED: "INVITED",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DEACTIVATED: "DEACTIVATED",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const IdentityProvider = {
  LOCAL: "LOCAL",
  GOOGLE: "GOOGLE",
  MICROSOFT: "MICROSOFT",
  ORCID: "ORCID",
  SAML: "SAML",
} as const;
export type IdentityProvider = (typeof IdentityProvider)[keyof typeof IdentityProvider];
