export const TransferManifestStatus = {
  DRAFT: "DRAFT",
  READY: "READY",
  SHARED: "SHARED",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
} as const;
export type TransferManifestStatus = (typeof TransferManifestStatus)[keyof typeof TransferManifestStatus];
