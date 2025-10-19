import { and, eq } from "drizzle-orm";

import type { PRRef } from "#src/types";
import { deps as depsTable } from "#src/db/schema";
import { db } from "#src/db/index";

export async function upsertDependentsAndDependencies(
    dependent: PRRef,
    deps: PRRef[],
) {
    await db
        .delete(depsTable)
        .where(
            and(
                eq(depsTable.dependentOwner, dependent.owner),
                eq(depsTable.dependentRepo, dependent.repo),
                eq(depsTable.dependentNum, dependent.num),
            ),
        );

    if (deps.length === 0) {
        return;
    }

    await db.insert(depsTable).values(
        deps.map((d) => ({
            dependentOwner: dependent.owner,
            dependentRepo: dependent.repo,
            dependentNum: dependent.num,
            depOwner: d.owner,
            depRepo: d.repo,
            depNum: d.num,
        })),
    );
}

export async function getDependenciesOf(dependent: PRRef): Promise<PRRef[]> {
    const rows = await db
        .select({
            owner: depsTable.depOwner,
            repo: depsTable.depRepo,
            num: depsTable.depNum,
        })
        .from(depsTable)
        .where(
            and(
                eq(depsTable.dependentOwner, dependent.owner),
                eq(depsTable.dependentRepo, dependent.repo),
                eq(depsTable.dependentNum, dependent.num),
            ),
        );
    return rows.map((r) => ({ owner: r.owner, repo: r.repo, num: r.num }));
}

export async function getDependentsOf(dep: PRRef): Promise<PRRef[]> {
    const rows = await db
        .select({
            owner: depsTable.dependentOwner,
            repo: depsTable.dependentRepo,
            num: depsTable.dependentNum,
        })
        .from(depsTable)
        .where(
            and(
                eq(depsTable.depOwner, dep.owner),
                eq(depsTable.depRepo, dep.repo),
                eq(depsTable.depNum, dep.num),
            ),
        );
    return rows.map((r) => ({ owner: r.owner, repo: r.repo, num: r.num }));
}
