import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const user = sqliteTable('user', {
	id: text('id').primaryKey(), // SHA256 hash of the two patterns
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	lastActiveAt: integer('last_active_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const tab = sqliteTable('tab', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull().default('Untitled'),
	content: text('content').notNull().default(''),
	order: integer('order').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const drop = sqliteTable('drop', {
	id: text('id').primaryKey(),
	tabId: text('tab_id')
		.notNull()
		.references(() => tab.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	type: text('type').notNull(), // 'text' | 'image' | 'video' | 'audio' | 'pdf' | 'file'
	content: text('content'),
	fileUrl: text('file_url'),
	fileName: text('file_name'),
	fileSize: integer('file_size'),
	mimeType: text('mime_type'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export type User = typeof user.$inferSelect;
export type Tab = typeof tab.$inferSelect;
export type Drop = typeof drop.$inferSelect;
