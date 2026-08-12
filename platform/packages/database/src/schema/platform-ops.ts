import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { userAccount } from "./identity";
import { organization } from "./organization";
import { annotation, resource } from "./resource";
import { technologyProfile } from "./technology-case";
import {
  contentFlagStatusEnum,
  moderationActionEnum,
  moderationTargetTypeEnum,
  notificationStatusEnum,
  outboxStatusEnum,
} from "./enums";

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => userAccount.id),
    scopeOrganizationId: uuid("scope_organization_id").references(() => organization.id),
    type: varchar("type", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    payload: jsonb("payload"),
    status: notificationStatusEnum("status").notNull().default("UNREAD"),
    dedupeKey: varchar("dedupe_key", { length: 255 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_notification_recipient_status_created").on(
      table.recipientUserId,
      table.status,
      table.createdAt,
    ),
    index("idx_notification_scope_org_created").on(table.scopeOrganizationId, table.createdAt),
    index("idx_notification_dedupe_key").on(table.dedupeKey),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => userAccount.id),
    scopeOrganizationId: uuid("scope_organization_id").references(() => organization.id),
    requestId: uuid("request_id"),
    action: varchar("action", { length: 150 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: varchar("entity_id", { length: 100 }).notNull(),
    beforeData: jsonb("before_data"),
    afterData: jsonb("after_data"),
    ipHash: varchar("ip_hash", { length: 128 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_audit_log_entity").on(table.entityType, table.entityId, table.createdAt),
    index("idx_audit_log_actor_created").on(table.actorUserId, table.createdAt),
    index("idx_audit_log_request_id").on(table.requestId),
  ],
);

export const outboxEvent = pgTable(
  "outbox_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aggregateType: varchar("aggregate_type", { length: 100 }).notNull(),
    aggregateId: varchar("aggregate_id", { length: 100 }).notNull(),
    eventType: varchar("event_type", { length: 150 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: outboxStatusEnum("status").notNull().default("PENDING"),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Phase 7 Sprint 7.3 — additive, both nullable (same pattern as
    // `resource_access_grant.source_transfer_manifest_id`). Optional correlation from the
    // API request that produced this event through to the worker's async processing of it:
    // `requestId` feeds structured logs, `traceparent` (W3C Trace Context) lets
    // OpenTelemetry link the worker's span back to the originating HTTP request's trace in
    // Jaeger. Populated only where `OutboxService.append()` is called with the optional
    // `context` argument — existing call sites remain valid unchanged.
    requestId: varchar("request_id", { length: 100 }),
    traceparent: varchar("traceparent", { length: 100 }),
  },
  (table) => [
    index("idx_outbox_status_available").on(table.status, table.availableAt),
    index("idx_outbox_aggregate").on(table.aggregateType, table.aggregateId),
  ],
);

export const idempotencyKey = pgTable(
  "idempotency_key",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userAccount.id),
    key: varchar("key", { length: 255 }).notNull(),
    requestHash: varchar("request_hash", { length: 128 }).notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_idempotency_key_user_key").on(table.userId, table.key),
    index("idx_idempotency_key_expires_at").on(table.expiresAt),
  ],
);

/** Phase 6 Sprint 6.3 — kiểm duyệt nội dung. `targetResourceId`/`targetAnnotationId`/
 * `targetTechnologyProfileId` — đúng 1 non-null, khớp `targetType` (CHECK trong manual
 * migration, cùng kỹ thuật `chk_content_flag_exactly_one_target` +
 * `chk_content_flag_target_matches_type` trong spec file gốc). Không có cột `version` —
 * concurrency giữa 2 reviewer cùng claim 1 flag chặn bằng WHERE status='PENDING' lúc
 * update (cùng pattern optimistic-lock-qua-status đã dùng ở
 * `case-initiations`/`transfer-manifests` sweep). */
export const contentFlag = pgTable(
  "content_flag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => userAccount.id),
    targetType: moderationTargetTypeEnum("target_type").notNull(),
    targetResourceId: uuid("target_resource_id").references(() => resource.id),
    targetAnnotationId: uuid("target_annotation_id").references(() => annotation.id),
    targetTechnologyProfileId: uuid("target_technology_profile_id").references(() => technologyProfile.id),
    reasonCode: varchar("reason_code", { length: 100 }).notNull(),
    details: text("details").notNull(),
    status: contentFlagStatusEnum("status").notNull().default("PENDING"),
    assignedReviewerUserId: uuid("assigned_reviewer_user_id").references(() => userAccount.id),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_content_flag_status_created").on(table.status, table.createdAt),
    index("idx_content_flag_assigned_reviewer").on(table.assignedReviewerUserId),
  ],
);

export const moderationDecision = pgTable(
  "moderation_decision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentFlagId: uuid("content_flag_id")
      .notNull()
      .references(() => contentFlag.id),
    reviewerUserId: uuid("reviewer_user_id")
      .notNull()
      .references(() => userAccount.id),
    action: moderationActionEnum("action").notNull(),
    rationale: text("rationale").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_moderation_decision_flag_created").on(table.contentFlagId, table.createdAt)],
);
