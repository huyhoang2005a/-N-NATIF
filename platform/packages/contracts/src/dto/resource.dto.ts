import { AccessPermission, ResourceAccessLevel, ResourceType } from "@r2m/domain";
import { z } from "zod";

const resourceTypeValues = Object.values(ResourceType) as [ResourceType, ...ResourceType[]];
const resourceAccessLevelValues = Object.values(ResourceAccessLevel) as [
  ResourceAccessLevel,
  ...ResourceAccessLevel[],
];
const accessPermissionValues = Object.values(AccessPermission) as [
  AccessPermission,
  ...AccessPermission[],
];

/** No official endpoint name in R2M_SPEC_DESIGN_V5_COMPLETE.md §13.2 for uploading a
 * resource file (UC-RES-01 input allows "external URL hoặc upload" but the catalogue
 * only lists URL-oriented endpoints) — path/shape mirrors
 * `RequestAuthorVerificationUploadSchema`, flagged as self-defined in the controller. */
export const RequestResourceUploadSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(150),
  sizeBytes: z.number().int().positive().max(200 * 1024 * 1024),
});
export type RequestResourceUploadRequest = z.infer<typeof RequestResourceUploadSchema>;

export interface ResourceUploadResponse {
  uploadUrl: string;
  storageObjectKey: string;
  expiresIn: number;
}

/** Content location is exactly one of `sourceUrl` (external link) or `storageObjectKey`
 * (uploaded via `RequestResourceUploadSchema`) — UC-RES-01 main flow step 1. */
const contentLocationFields = {
  sourceUrl: z.string().url().optional(),
  storageObjectKey: z.string().min(1).optional(),
};

function refineExactlyOneContentLocation(
  value: { sourceUrl?: unknown; storageObjectKey?: unknown },
  ctx: z.RefinementCtx,
): void {
  const count = [value.sourceUrl, value.storageObjectKey].filter((v) => v !== undefined).length;
  if (count !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Exactly one of sourceUrl or storageObjectKey is required.",
      path: ["sourceUrl"],
    });
  }
}

/** PAPER-only metadata (UC-RES-01: "PAPER có DOI/authors/publication fields") — the
 * service layer rejects these fields for any other `type` (RESOURCE_INVALID_TYPE_FOR_
 * PAPER_METADATA). */
const paperMetadataFields = {
  doi: z.string().trim().max(255).optional(),
  abstract: z.string().trim().optional(),
  publisher: z.string().trim().max(255).optional(),
  venue: z.string().trim().max(255).optional(),
  publicationDate: z.string().date().optional(),
  language: z.string().trim().max(20).optional(),
};

export const RegisterResourceRequestSchema = z
  .object({
    ownerOrganizationId: z.string().uuid(),
    type: z.enum(resourceTypeValues),
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().optional(),
    accessLevel: z.enum(resourceAccessLevelValues),
    externalIdentifier: z.string().trim().max(255).optional(),
    ...contentLocationFields,
    ...paperMetadataFields,
  })
  .superRefine(refineExactlyOneContentLocation);
export type RegisterResourceRequest = z.infer<typeof RegisterResourceRequestSchema>;

export const CreateResourceVersionRequestSchema = z
  .object({
    versionLabel: z.string().trim().max(100).optional(),
    ...contentLocationFields,
  })
  .superRefine(refineExactlyOneContentLocation);
export type CreateResourceVersionRequest = z.infer<typeof CreateResourceVersionRequestSchema>;

const annotationLocatorFields = {
  targetSnippet: z.string().trim().min(1),
  pageNumber: z.number().int().nonnegative().optional(),
  sectionLabel: z.string().trim().max(255).optional(),
  offsetStart: z.number().int().nonnegative().optional(),
  offsetEnd: z.number().int().nonnegative().optional(),
};

/** UC-RES-02 business invariant: content không rỗng. */
export const CreateAnnotationRequestSchema = z.object({
  content: z.string().trim().min(1),
  ...annotationLocatorFields,
});
export type CreateAnnotationRequest = z.infer<typeof CreateAnnotationRequestSchema>;

export const ReviseAnnotationRequestSchema = z.object({
  content: z.string().trim().min(1),
  ...annotationLocatorFields,
});
export type ReviseAnnotationRequest = z.infer<typeof ReviseAnnotationRequestSchema>;

/** SUC-04 (đã chốt sau review, 2026-08-05): grant tạo ACTIVE trực tiếp, không có state
 * PENDING/entity request riêng — "request" trong tên use case chỉ là hành động
 * resource-manager cấp quyền. Recipient là user XOR organization. */
export const CreateResourceAccessRequestSchema = z
  .object({
    recipientUserId: z.string().uuid().optional(),
    recipientOrganizationId: z.string().uuid().optional(),
    permission: z.enum(accessPermissionValues),
    expiresAt: z.string().datetime().optional(),
  })
  .refine(
    (value) => [value.recipientUserId, value.recipientOrganizationId].filter(Boolean).length === 1,
    {
      message: "Exactly one of recipientUserId or recipientOrganizationId is required.",
      path: ["recipientUserId"],
    },
  );
export type CreateResourceAccessRequest = z.infer<typeof CreateResourceAccessRequestSchema>;

export interface ResourceResponse {
  id: string;
  ownerOrganizationId: string;
  createdByUserId: string;
  type: string;
  title: string;
  description: string | null;
  accessLevel: string;
  status: string;
  moderationStatus: string;
  externalIdentifier: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  /** Community layer (đợt 1) — upvote count is actor-independent (safe on any
   * authenticated response); `votedByMe` only meaningful when fetched by an authenticated
   * actor, always present here since this type is never returned by an unauthenticated
   * endpoint. */
  voteCount: number;
  votedByMe: boolean;
  /** Community layer (đợt 2) — bookmark, same actor-scoping note as `votedByMe` above. */
  savedByMe: boolean;
}

export interface ResourceVersionResponse {
  id: string;
  resourceId: string;
  versionNo: number;
  versionLabel: string | null;
  sourceUrl: string | null;
  storageObjectKey: string | null;
  contentHashSha256: string | null;
  publishedAt: string | null;
  status: string;
  createdByUserId: string;
  createdAt: string;
}

export interface AnnotationResponse {
  id: string;
  resourceVersionId: string;
  createdByUserId: string;
  status: string;
  latestRevisionNo: number;
  content: string;
  targetSnippet: string;
  pageNumber: number | null;
  sectionLabel: string | null;
  offsetStart: number | null;
  offsetEnd: number | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /resources/:id/versions/:versionId/content-url` — presigned S3 GET URL for the
 * version's uploaded file, same shape as `ResourceUploadResponse`'s presign-on-write
 * counterpart. Only issued for a PUBLISHED version (or any version if the actor is the
 * resource's creator) with a real `storageObjectKey` — see resources.service.ts. */
export interface ResourceVersionContentUrlResponse {
  url: string;
  expiresIn: number;
}

/** `POST /resources/:id/versions/:versionId/summarize` — Gemini-generated Vietnamese
 * summary of the version's extracted text (`resource_chunk` rows). `summary` is null when
 * the version has no extracted chunks yet (ingestion not done / nothing to summarize) —
 * distinct from the `ASSISTANT_UNAVAILABLE` error thrown when Gemini itself isn't
 * configured or fails. */
export interface ResourceVersionSummaryResponse {
  summary: string | null;
}

export interface ResourceAccessGrantResponse {
  id: string;
  resourceId: string;
  recipientOrganizationId: string | null;
  recipientUserId: string | null;
  permission: string;
  status: string;
  grantedByUserId: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  createdAt: string;
}
