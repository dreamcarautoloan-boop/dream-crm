import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with CRM-specific roles and team structure.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: text("name").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  // CRM Roles: sales_manager, team_leader, sales, moderator
  role: mysqlEnum("role", ["sales_manager", "team_leader", "sales", "moderator"]).notNull(),
  // Team assignment for sales and moderators
  teamId: int("teamId"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => [
  index("idx_role").on(table.role),
  index("idx_teamId").on(table.teamId),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Team/Company structure
 */
export const teams = mysqlTable("teams", {
  id: int("id").autoincrement().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;

/**
 * Lead Source tracking
 */
export const leadSources = mysqlTable("leadSources", {
  id: int("id").autoincrement().primaryKey(),
  name: mysqlEnum("name", ["external_call", "facebook_leads", "referral", "existing_customer"]).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeadSource = typeof leadSources.$inferSelect;
export type InsertLeadSource = typeof leadSources.$inferInsert;

/**
 * Customers/Leads - Main entity for tracking prospects and customers
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  // Customer identification
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }),
  // Source and assignment
  sourceId: int("sourceId").notNull(),
  assignedToSalesId: int("assignedToSalesId").notNull(),
  // Customer status in the pipeline
  status: mysqlEnum("status", [
    "new_lead",           // Just added
    "qualified",          // Qualified by sales
    "unqualified",        // Not interested
    "in_progress",        // Being worked on
    "sales_opportunity",  // Has sent installment docs
    "closed_won",         // Successfully sold
    "closed_lost",        // Deal lost
    "inactive"            // Not pursuing
  ]).default("new_lead").notNull(),
  // Qualification and interest level
  isQualified: boolean("isQualified").default(false),
  interestLevel: mysqlEnum("interestLevel", ["interested", "thinking", "not_interested"]),
  // Duplicate prevention
  isDuplicate: boolean("isDuplicate").default(false),
  duplicateOfId: int("duplicateOfId"),
  // Metadata
  externalId: varchar("externalId", { length: 100 }), // For Facebook leads
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_phone").on(table.phone),
  index("idx_assignedToSalesId").on(table.assignedToSalesId),
  index("idx_status").on(table.status),
  index("idx_isDuplicate").on(table.isDuplicate),
]);

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * Sales Notes - Track all communication and follow-ups
 */
export const salesNotes = mysqlTable("salesNotes", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  createdBySalesId: int("createdBySalesId").notNull(),
  note: text("note").notNull(),
  // Note type
  noteType: mysqlEnum("noteType", ["call", "whatsapp", "email", "meeting", "follow_up"]).notNull(),
  // Outcome of the interaction
  outcome: mysqlEnum("outcome", ["interested", "thinking", "not_interested", "qualified", "unqualified"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_customerId").on(table.customerId),
  index("idx_createdBySalesId").on(table.createdBySalesId),
]);

export type SalesNote = typeof salesNotes.$inferSelect;
export type InsertSalesNote = typeof salesNotes.$inferInsert;

/**
 * Follow-up Schedule - Track scheduled follow-ups
 */
export const followUps = mysqlTable("followUps", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  assignedToSalesId: int("assignedToSalesId").notNull(),
  scheduledDate: timestamp("scheduledDate").notNull(),
  // Follow-up status
  status: mysqlEnum("status", ["pending", "completed", "cancelled", "rescheduled"]).default("pending").notNull(),
  // Reason for follow-up
  reason: text("reason"),
  // Result of follow-up
  result: text("result"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_customerId").on(table.customerId),
  index("idx_assignedToSalesId").on(table.assignedToSalesId),
  index("idx_scheduledDate").on(table.scheduledDate),
  index("idx_status").on(table.status),
]);

export type FollowUp = typeof followUps.$inferSelect;
export type InsertFollowUp = typeof followUps.$inferInsert;

/**
 * Installment Partners - Banks and financing companies
 */
export const installmentPartners = mysqlTable("installmentPartners", {
  id: int("id").autoincrement().primaryKey(),
  name: mysqlEnum("name", ["drive", "contact", "aman", "one_finance", "bedaya", "bank"]).notNull(),
  displayName: varchar("displayName", { length: 100 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InstallmentPartner = typeof installmentPartners.$inferSelect;
export type InsertInstallmentPartner = typeof installmentPartners.$inferInsert;

/**
 * Installment Applications - Track installment requests and their status
 */
export const installmentApplications = mysqlTable("installmentApplications", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  partnerId: int("partnerId").notNull(),
  // Application status
  status: mysqlEnum("status", [
    "submitted",        // Initial submission
    "pending",          // Waiting for documents
    "approved",         // Approved
    "rejected",         // Rejected
    "customer_rejected" // Customer rejected
  ]).default("submitted").notNull(),
  // Application details
  loanAmount: decimal("loanAmount", { precision: 12, scale: 2 }),
  monthlyPayment: decimal("monthlyPayment", { precision: 12, scale: 2 }),
  duration: int("duration"), // in months
  // Reason for rejection or pending documents
  reason: text("reason"),
  requiredDocuments: text("requiredDocuments"), // JSON array of required docs
  submittedDocuments: text("submittedDocuments"), // JSON array of submitted docs
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_customerId").on(table.customerId),
  index("idx_partnerId").on(table.partnerId),
  index("idx_status").on(table.status),
]);

export type InstallmentApplication = typeof installmentApplications.$inferSelect;
export type InsertInstallmentApplication = typeof installmentApplications.$inferInsert;

/**
 * Sales Opportunities - Converted from leads to sales opportunities
 */
export const salesOpportunities = mysqlTable("salesOpportunities", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  installmentApplicationId: int("installmentApplicationId").notNull(),
  // Vehicle details
  vehicleType: mysqlEnum("vehicleType", ["new", "used"]).notNull(),
  vehicleModel: varchar("vehicleModel", { length: 100 }),
  vehiclePrice: decimal("vehiclePrice", { precision: 12, scale: 2 }),
  // Opportunity status
  status: mysqlEnum("status", [
    "inspection_pending",  // Waiting for inspection (used car)
    "quote_pending",       // Waiting for quote (new car)
    "contract_pending",    // Waiting for contract signature
    "registration_pending",// Waiting for registration/licensing
    "completed",           // Deal completed
    "cancelled"            // Deal cancelled
  ]).default("inspection_pending").notNull(),
  // Inspection/Quote details
  inspectionDate: timestamp("inspectionDate"),
  inspectionResult: text("inspectionResult"),
  quoteDate: timestamp("quoteDate"),
  quoteDetails: text("quoteDetails"),
  // Contract details
  contractSignedDate: timestamp("contractSignedDate"),
  registrationDate: timestamp("registrationDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_customerId").on(table.customerId),
  index("idx_status").on(table.status),
]);

export type SalesOpportunity = typeof salesOpportunities.$inferSelect;
export type InsertSalesOpportunity = typeof salesOpportunities.$inferInsert;

/**
 * Lost Deals - Track closed deals that were lost
 */
export const lostDeals = mysqlTable("lostDeals", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  closedBySalesId: int("closedBySalesId").notNull(),
  // Reason for losing the deal
  reason: text("reason").notNull(),
  reasonCategory: mysqlEnum("reasonCategory", [
    "customer_not_interested",
    "financing_rejected",
    "found_competitor",
    "price_issue",
    "timing_issue",
    "other"
  ]).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_customerId").on(table.customerId),
  index("idx_closedBySalesId").on(table.closedBySalesId),
]);

export type LostDeal = typeof lostDeals.$inferSelect;
export type InsertLostDeal = typeof lostDeals.$inferInsert;

/**
 * Activity Log - Audit trail for all actions
 */
export const activityLog = mysqlTable("activityLog", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  customerId: int("customerId"),
  action: varchar("action", { length: 100 }).notNull(),
  description: text("description"),
  metadata: text("metadata"), // JSON
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_userId").on(table.userId),
  index("idx_customerId").on(table.customerId),
  index("idx_createdAt").on(table.createdAt),
]);

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;
