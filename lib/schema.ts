import { pgTable, serial, text, timestamp, varchar, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  user_id: serial('user_id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const fishes = pgTable('fishes', {
  fish_id: serial('fish_id').primaryKey(),
  artist_name: varchar('artist_name', { length: 255 }).notNull(),
  image_data: text('image_data').notNull(),
  likes: integer('likes').default(0).notNull(),
  dislikes: integer('dislikes').default(0).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),

  // 新增：指向用户的外键
  user_id: integer('user_id').references(() => users.user_id, { onDelete: 'cascade' }),
});

// ✅ 定义关系（方便 drizzle 查询）
export const usersRelations = relations(users, ({ many }) => ({
  fishes: many(fishes),
}));

export const fishesRelations = relations(fishes, ({ one }) => ({
  user: one(users, {
    fields: [fishes.user_id],
    references: [users.user_id],
  }),
}));
