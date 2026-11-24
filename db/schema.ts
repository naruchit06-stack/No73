import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  memberUntil: timestamp("memberUntil"),
  notifiedSignup: boolean("notifiedSignup").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export const novels = mysqlTable(
  "novels",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    author: varchar("author", { length: 255 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    description: text("description").notNull(),
    coverKey: text("coverKey"),
    coverUrl: text("coverUrl"),
    featured: boolean("featured").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("novel_category_idx").on(table.category)],
);

export const episodes = mysqlTable(
  "episodes",
  {
    id: serial("id").primaryKey(),
    novelId: bigint("novelId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    number: int("number").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    duration: int("duration").default(0).notNull(),
    audioKey: text("audioKey"),
    audioUrl: text("audioUrl"),
    isPremium: boolean("isPremium").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("episode_novel_number_idx").on(table.novelId, table.number),
    index("episode_novel_idx").on(table.novelId),
  ],
);

export const listeningProgress = mysqlTable(
  "listening_progress",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    episodeId: bigint("episodeId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    position: int("position").default(0).notNull(),
    duration: int("duration").default(0).notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("progress_user_episode_idx").on(table.userId, table.episodeId),
    index("progress_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Novel = typeof novels.$inferSelect;
export type Episode = typeof episodes.$inferSelect;
export type ListeningProgress = typeof listeningProgress.$inferSelect;

export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const paymentRequests = mysqlTable(
  "payment_requests",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: int("amount").notNull(),
    note: varchar("note", { length: 500 }),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
    reviewedBy: bigint("reviewedBy", { mode: "number", unsigned: true }).references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("payment_status_created_idx").on(table.status, table.createdAt),
    index("payment_user_idx").on(table.userId),
  ],
);

export type Setting = typeof settings.$inferSelect;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
