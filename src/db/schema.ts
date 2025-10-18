import { pgTable, varchar, integer, index, uuid } from "drizzle-orm/pg-core";

export const deps = pgTable(
    "deps",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        dependentOwner: varchar("dependent_owner").notNull(),
        dependentRepo: varchar("dependent_repo").notNull(),
        dependentNum: integer("dependent_num").notNull(),
        depOwner: varchar("dep_owner").notNull(),
        depRepo: varchar("dep_repo").notNull(),
        depNum: integer("dep_num").notNull(),
    },
    (table) => [
        index("deps_dependent_repo_idx").on(
            table.dependentOwner,
            table.dependentRepo,
        ),
        index("deps_dep_repo_idx").on(table.depOwner, table.depRepo),
    ],
);
