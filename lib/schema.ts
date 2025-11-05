import { pgTable, serial, text, timestamp, varchar, integer, unique } from 'drizzle-orm/pg-core';

export const fishes = pgTable('fishes', {
  fish_id: serial('fish_id').primaryKey(),
  artist_name: varchar('artist_name', { length: 255 }).notNull(),
  image_data: text('image_data').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  user_id: serial('user_id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  fish_id: integer('fish_id').references(() => fishes.fish_id, { onDelete: 'cascade' }),
}, (table) => {
  return {
    fish_id_unique: unique('fish_id_unique').on(table.fish_id),
  }
});