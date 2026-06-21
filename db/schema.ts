import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core"

// ─── Enums ────────────────────────────────────────────────────────────────────

export const sourceTypeEnum = pgEnum("source_type", ["pdf", "url", "youtube", "text"])
export const sourceStatusEnum = pgEnum("source_status", [
  "pending",
  "processing",
  "ready",
  "error",
])
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"])
export const studioOutputTypeEnum = pgEnum("studio_output_type", [
  "audio",
  "mindmap",
  "slidedeck",
  "datatable",
  "quiz",
])

// ─── Auth (NextAuth Drizzle Adapter) ──────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})

export const accounts = pgTable("accounts", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
})

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

// ─── Notebooks ────────────────────────────────────────────────────────────────

export const notebooks = pgTable("notebooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})

// ─── Sources ──────────────────────────────────────────────────────────────────

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  notebookId: uuid("notebook_id")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" }),
  type: sourceTypeEnum("type").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  s3Key: text("s3_key"),
  fileHash: text("file_hash"),
  summary: text("summary"),
  suggestedTopics: jsonb("suggested_topics").$type<string[]>(),
  embedProgress: integer("embed_progress").notNull().default(0),
  status: sourceStatusEnum("status").notNull().default("pending"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})

export const sourceImages = pgTable("source_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  s3Url: text("s3_url").notNull(),
  pageNumber: integer("page_number"),
  bbox: jsonb("bbox").$type<{ x: number; y: number; width: number; height: number }>(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})

// ─── Chunks ───────────────────────────────────────────────────────────────────

export const parentChunks = pgTable("parent_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  pageNumber: integer("page_number"),
  positionStart: integer("position_start"),
  positionEnd: integer("position_end"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})

export const childChunks = pgTable("child_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentChunkId: uuid("parent_chunk_id")
    .notNull()
    .references(() => parentChunks.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1024 }),
  pageNumber: integer("page_number"),
  positionStart: integer("position_start"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  notebookId: uuid("notebook_id")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" }),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})

export const messageCitations = pgTable("message_citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  childChunkId: uuid("child_chunk_id")
    .notNull()
    .references(() => childChunks.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
})

// ─── Notes ────────────────────────────────────────────────────────────────────

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  notebookId: uuid("notebook_id")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Neue Notiz"),
  content: text("content").notNull(),
  sourceMessageId: uuid("source_message_id").references(() => messages.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})

// ─── Studio Outputs ───────────────────────────────────────────────────────────

export const studioOutputs = pgTable("studio_outputs", {
  id: uuid("id").primaryKey().defaultRandom(),
  notebookId: uuid("notebook_id")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" }),
  type: studioOutputTypeEnum("type").notNull(),
  title: text("title"),
  data: jsonb("data"),
  s3Key: text("s3_key"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type Notebook = typeof notebooks.$inferSelect
export type Source = typeof sources.$inferSelect
export type SourceImage = typeof sourceImages.$inferSelect
export type ParentChunk = typeof parentChunks.$inferSelect
export type ChildChunk = typeof childChunks.$inferSelect
export type Message = typeof messages.$inferSelect
export type Note = typeof notes.$inferSelect
export type StudioOutput = typeof studioOutputs.$inferSelect
