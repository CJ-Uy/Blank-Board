CREATE TABLE `drop` (
	`id` text PRIMARY KEY NOT NULL,
	`tab_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`content` text,
	`file_url` text,
	`file_name` text,
	`file_size` integer,
	`mime_type` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tab_id`) REFERENCES `tab`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
