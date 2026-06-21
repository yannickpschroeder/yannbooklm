ALTER TABLE "notebooks" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "notebooks" ADD COLUMN "share_scope" text;--> statement-breakpoint
ALTER TABLE "notebooks" ADD CONSTRAINT "notebooks_share_token_unique" UNIQUE("share_token");