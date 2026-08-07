import { index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { citext } from "./custom-types";
import { identityProviderEnum, platformRoleEnum, userStatusEnum } from "./enums";

export const userAccount = pgTable(
  "user_account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    primaryEmail: citext("primary_email").notNull().unique(),
    platformRole: platformRoleEnum("platform_role").notNull().default("USER"),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("idx_user_account_status").on(table.status), index("idx_user_account_platform_role").on(table.platformRole)],
);

export const userIdentity = pgTable(
  "user_identity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userAccount.id),
    provider: identityProviderEnum("provider").notNull(),
    providerSubject: varchar("provider_subject", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("uq_user_identity_provider_subject").on(table.provider, table.providerSubject),
    index("idx_user_identity_user_id").on(table.userId),
  ],
);

export const emailVerificationToken = pgTable(
  "email_verification_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userAccount.id),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    purpose: varchar("purpose", { length: 50 }).notNull().default("EMAIL_VERIFICATION"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_email_verification_token_user_purpose").on(table.userId, table.purpose)],
);

export const userProfile = pgTable("user_profile", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => userAccount.id),
  displayName: varchar("display_name", { length: 200 }).notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  phone: varchar("phone", { length: 30 }),
  avatarUrl: text("avatar_url"),
  jobTitle: varchar("job_title", { length: 150 }),
  locale: varchar("locale", { length: 20 }).default("vi-VN"),
  timezone: varchar("timezone", { length: 50 }).default("Asia/Bangkok"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
