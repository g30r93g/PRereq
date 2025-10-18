import type { ExtractedDeps, PRRef } from "#src/types";

const REF = /\b([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#(\d+)\b/g; // org/repo#123
const SAME_ORG = /\b([A-Za-z0-9_.-]+)#(\d+)\b/g; // repo#123
const SAME_REPO = /\B#(\d+)\b/g; // #123
const INTENT =
    /(depends on|blocked by|requires|needs|prerequisite|merge first)/i;

export function extractDeps(
    text: string,
    owner: string,
    repo: string,
): ExtractedDeps {
    if (!text) {
        return { deps: [], enforce: false };
    }
    REF.lastIndex = 0;
    SAME_ORG.lastIndex = 0;
    SAME_REPO.lastIndex = 0;
    const enforce = INTENT.test(text);
    const set = new Set<string>();

    let m: RegExpExecArray | null;
    while ((m = REF.exec(text))) {
        set.add(`${m[1]}/${m[2]}#${m[3]}`);
    }
    while ((m = SAME_ORG.exec(text))) {
        set.add(`${owner}/${m[1]}#${m[2]}`);
    }
    while ((m = SAME_REPO.exec(text))) {
        set.add(`${owner}/${repo}#${m[1]}`);
    }

    const deps: PRRef[] = [...set].map((s) => {
        const [full, num] = s.split("#");
        const [o, r] = full.split("/");
        return { owner: o, repo: r, num: Number(num) };
    });
    return { deps, enforce };
}
