CREATE TABLE "deps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dependent_owner" varchar NOT NULL,
	"dependent_repo" varchar NOT NULL,
	"dependent_num" integer NOT NULL,
	"dep_owner" varchar NOT NULL,
	"dep_repo" varchar NOT NULL,
	"dep_num" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "deps_dependent_repo_idx" ON "deps" USING btree ("dependent_owner","dependent_repo");--> statement-breakpoint
CREATE INDEX "deps_dep_repo_idx" ON "deps" USING btree ("dep_owner","dep_repo");