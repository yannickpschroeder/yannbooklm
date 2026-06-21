CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notebooks" ADD COLUMN "output_language" text;--> statement-breakpoint
ALTER TABLE "studio_outputs" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "studio_outputs" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_outputs" ADD CONSTRAINT "studio_outputs_share_token_unique" UNIQUE("share_token");