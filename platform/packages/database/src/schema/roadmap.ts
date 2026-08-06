import { date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { userAccount } from "./identity";
import { technologyCase } from "./technology-case";
import { gapRecord } from "./assessment-gap";
import {
  dependencyTypeEnum,
  milestoneStatusEnum,
  priorityLevelEnum,
  roadmapReviewDecisionEnum,
  roadmapStatusEnum,
  taskStatusEnum,
} from "./enums";

export const roadmap = pgTable(
  "roadmap",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technologyCaseId: uuid("technology_case_id")
      .notNull()
      .references(() => technologyCase.id),
    versionNo: integer("version_no").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    objective: text("objective"),
    status: roadmapStatusEnum("status").notNull().default("DRAFT"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    submittedByUserId: uuid("submitted_by_user_id").references(() => userAccount.id),
    approvedByUserId: uuid("approved_by_user_id").references(() => userAccount.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("uq_roadmap_case_version").on(table.technologyCaseId, table.versionNo),
    index("idx_roadmap_case_status").on(table.technologyCaseId, table.status),
  ],
);

export const roadmapMilestone = pgTable(
  "roadmap_milestone",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roadmapId: uuid("roadmap_id")
      .notNull()
      .references(() => roadmap.id),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: milestoneStatusEnum("status").notNull().default("NOT_STARTED"),
    priority: priorityLevelEnum("priority").notNull().default("MEDIUM"),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    ownerUserId: uuid("owner_user_id").references(() => userAccount.id),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("idx_roadmap_milestone_roadmap_sort").on(table.roadmapId, table.sortOrder),
    index("idx_roadmap_milestone_roadmap_status").on(table.roadmapId, table.status),
  ],
);

export const roadmapTask = pgTable(
  "roadmap_task",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    milestoneId: uuid("milestone_id")
      .notNull()
      .references(() => roadmapMilestone.id),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("TODO"),
    priority: priorityLevelEnum("priority").notNull().default("MEDIUM"),
    assigneeUserId: uuid("assignee_user_id").references(() => userAccount.id),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("idx_roadmap_task_milestone_sort").on(table.milestoneId, table.sortOrder),
    index("idx_roadmap_task_assignee_status").on(table.assigneeUserId, table.status),
  ],
);

export const milestoneDependency = pgTable(
  "milestone_dependency",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    predecessorMilestoneId: uuid("predecessor_milestone_id")
      .notNull()
      .references(() => roadmapMilestone.id),
    successorMilestoneId: uuid("successor_milestone_id")
      .notNull()
      .references(() => roadmapMilestone.id),
    dependencyType: dependencyTypeEnum("dependency_type").notNull().default("FINISH_TO_START"),
    lagDays: integer("lag_days").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_milestone_dependency_predecessor_successor").on(
      table.predecessorMilestoneId,
      table.successorMilestoneId,
    ),
    index("idx_milestone_dependency_successor").on(table.successorMilestoneId),
  ],
);

export const milestoneGap = pgTable(
  "milestone_gap",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    milestoneId: uuid("milestone_id")
      .notNull()
      .references(() => roadmapMilestone.id),
    gapRecordId: uuid("gap_record_id")
      .notNull()
      .references(() => gapRecord.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uq_milestone_gap_milestone_gap").on(table.milestoneId, table.gapRecordId)],
);

export const roadmapReview = pgTable(
  "roadmap_review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roadmapId: uuid("roadmap_id")
      .notNull()
      .references(() => roadmap.id),
    reviewerUserId: uuid("reviewer_user_id")
      .notNull()
      .references(() => userAccount.id),
    decision: roadmapReviewDecisionEnum("decision").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_roadmap_review_roadmap_created").on(table.roadmapId, table.createdAt)],
);
