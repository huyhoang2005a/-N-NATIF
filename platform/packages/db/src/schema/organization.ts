import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { userAccount } from "./identity";
import { citext } from "./custom-types";
import {
  membershipStatusEnum,
  organizationMemberRoleEnum,
  organizationStatusEnum,
  organizationTypeEnum,
  verificationRequestStatusEnum,
} from "./enums";

export const organization = pgTable(
  "organization",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    type: organizationTypeEnum("type").notNull(),
    status: organizationStatusEnum("status").notNull().default("PENDING_VERIFICATION"),
    website: text("website"),
    taxCode: varchar("tax_code", { length: 100 }),
    institutionIdentifier: varchar("institution_identifier", { length: 150 }),
    description: text("description"),
    primaryContactUserId: uuid("primary_contact_user_id").references(() => userAccount.id),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("idx_organization_name_type").on(table.name, table.type),
    index("idx_organization_status").on(table.status),
    index("idx_organization_tax_code").on(table.taxCode),
  ],
);

export const organizationDomain = pgTable(
  "organization_domain",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id),
    domain: citext("domain").notNull().unique(),
    verificationTokenHash: varchar("verification_token_hash", { length: 255 }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_organization_domain_org_id").on(table.organizationId)],
);

export const organizationVerificationRequest = pgTable(
  "organization_verification_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id),
    submittedByUserId: uuid("submitted_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    status: verificationRequestStatusEnum("status").notNull().default("PENDING"),
    reviewerUserId: uuid("reviewer_user_id").references(() => userAccount.id),
    reviewerNote: text("reviewer_note"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_org_verification_org_status").on(table.organizationId, table.status),
    index("idx_org_verification_status_submitted").on(table.status, table.submittedAt),
  ],
);

export const organizationMember = pgTable(
  "organization_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => userAccount.id),
    role: organizationMemberRoleEnum("role").notNull().default("MEMBER"),
    status: membershipStatusEnum("status").notNull().default("INVITED"),
    invitedByUserId: uuid("invited_by_user_id").references(() => userAccount.id),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    leftAt: timestamp("left_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_organization_member_org_user").on(table.organizationId, table.userId),
    index("idx_organization_member_user_status").on(table.userId, table.status),
    index("idx_organization_member_org_role_status").on(
      table.organizationId,
      table.role,
      table.status,
    ),
  ],
);
