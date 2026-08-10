import { AccessPermission } from "@r2m/domain";
import { z } from "zod";

const accessPermissionValues = Object.values(AccessPermission) as [AccessPermission, ...AccessPermission[]];

export const CreateTransferManifestRequestSchema = z.object({
  title: z.string().trim().min(1).max(255),
  note: z.string().trim().max(2000).optional(),
});
export type CreateTransferManifestRequest = z.infer<typeof CreateTransferManifestRequestSchema>;

/** `locationUrlSnapshot`/`checksumSha256`/`metadataSnapshot` are NOT client input — the
 * service resolves and snapshots them from the resource version at add-time (UC-TRF-01
 * business invariant: "Không chứa file binary trong manifest", chỉ metadata/location). */
export const AddTransferManifestItemRequestSchema = z.object({
  resourceVersionId: z.string().uuid(),
  permission: z.enum(accessPermissionValues).optional(),
});
export type AddTransferManifestItemRequest = z.infer<typeof AddTransferManifestItemRequestSchema>;

/** Recipient là user XOR organization — cùng nguyên tắc `CreateResourceAccessRequestSchema`
 * (resource.dto.ts). `expiresAt` ở đây tuỳ chọn — không đặt thì dùng expiry chung của lượt
 * share (`ShareTransferManifestRequestSchema.expiresAt`, bắt buộc) khi tạo access grant. */
export const AddTransferRecipientRequestSchema = z
  .object({
    recipientUserId: z.string().uuid().optional(),
    recipientOrganizationId: z.string().uuid().optional(),
    permission: z.enum(accessPermissionValues).optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .refine((value) => [value.recipientUserId, value.recipientOrganizationId].filter(Boolean).length === 1, {
    message: "Exactly one of recipientUserId or recipientOrganizationId is required.",
    path: ["recipientUserId"],
  });
export type AddTransferRecipientRequest = z.infer<typeof AddTransferRecipientRequestSchema>;

/** Bắt buộc — mọi `resource_access_grant` sinh ra từ lượt share này phải có expiry (business
 * invariant UC-TRF-01), dùng làm giá trị mặc định cho recipient không tự đặt `expiresAt`
 * riêng ở `AddTransferRecipientRequestSchema`. */
export const ShareTransferManifestRequestSchema = z.object({
  expiresAt: z.string().datetime(),
});
export type ShareTransferManifestRequest = z.infer<typeof ShareTransferManifestRequestSchema>;

export interface TransferManifestResponse {
  id: string;
  technologyCaseId: string;
  versionNo: number;
  title: string;
  status: string;
  createdByUserId: string;
  generatedAt: string | null;
  sharedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  note: string | null;
  itemCount: number;
  recipientCount: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface TransferManifestItemResponse {
  id: string;
  transferManifestId: string;
  resourceVersionId: string;
  locationUrlSnapshot: string;
  checksumSha256: string | null;
  permission: string;
  createdAt: string;
}

export interface TransferRecipientResponse {
  id: string;
  transferManifestId: string;
  recipientOrganizationId: string | null;
  recipientUserId: string | null;
  permission: string;
  expiresAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

export interface TransferManifestDetailResponse extends TransferManifestResponse {
  items: TransferManifestItemResponse[];
  recipients: TransferRecipientResponse[];
}
