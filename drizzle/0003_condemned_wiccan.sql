ALTER TYPE "public"."studio_output_type" ADD VALUE 'flashcards';--> statement-breakpoint
ALTER TYPE "public"."studio_output_type" ADD VALUE 'report';--> statement-breakpoint
ALTER TABLE "studio_outputs" ADD COLUMN "status" text DEFAULT 'ready' NOT NULL;