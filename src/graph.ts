import { getDependentsOf } from "#src/db/fns";

export type PRRef = { owner: string; repo: string; num: number };
export type CycleResult =
    | { hasCycle: false }
    | { hasCycle: true; cyclePath: PRRef[] };

const MAX_NODES = 200;

const key = (pr: PRRef) => {
    return `${pr.owner}/${pr.repo}#${pr.num}`;
};

/**
 * Depth-first search to detect a cycle that includes `start`.
 * Returns the first found cycle path if any, e.g. A#1 -> B#2 -> C#3 -> A#1.
 */
export async function detectCycle(start: PRRef): Promise<CycleResult> {
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const path: PRRef[] = [];
    let explored = 0;

    const dfs = async (node: PRRef): Promise<CycleResult> => {
        const k = key(node);
        if (inStack.has(k)) {
            // Found a back-edge: slice path to cycle start
            const idx = path.findIndex((p) => key(p) === k);
            const cyclePath = [...path.slice(idx), node];
            return { hasCycle: true, cyclePath };
        }
        if (visited.has(k)) return { hasCycle: false };

        visited.add(k);
        inStack.add(k);
        path.push(node);

        if (++explored > MAX_NODES) {
            // Treat as cycle-like failure to be safe
            return {
                hasCycle: true,
                cyclePath: [...path, start], // show partial loop
            };
        }

        const deps = await getDependentsOf(node); // direct dependencies only
        for (const dep of deps) {
            const res = await dfs(dep);
            if (res.hasCycle) return res;
        }

        path.pop();
        inStack.delete(k);
        return { hasCycle: false };
    };

    return dfs(start);
}
