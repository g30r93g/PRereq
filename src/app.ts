import type { Probot, Context as ProbotContext, ProbotOctokit } from "probot";

import { setCheckRun } from "#src/check";
import { getDependentsOf, upsertDependentsAndDependencies } from "#src/db/fns";
import { extractDeps } from "#src/parse";
import type {
    DepStatus,
    EvaluationPayload,
    PRRef,
    PullRequestDetails,
} from "#src/types";
import { detectCycle } from "./graph";

const BLOCKING_COMMENT_TEMPLATE = (dependent: PRRef) =>
    `This PR is blocking ${dependent.owner}/${dependent.repo}#${dependent.num}`;

async function ensureBlockingComments(
    octokit: ProbotOctokit,
    dependent: PRRef,
    deps: PRRef[],
): Promise<void> {
    for (const dep of deps) {
        const body = BLOCKING_COMMENT_TEMPLATE(dependent);
        const existing = await octokit.paginate(octokit.issues.listComments, {
            owner: dep.owner,
            repo: dep.repo,
            issue_number: dep.num,
            per_page: 100,
        });

        const alreadyCommented = existing.some(
            (comment) => comment.body?.trim() === body,
        );
        if (alreadyCommented) {
            continue;
        }

        await octokit.issues.createComment({
            owner: dep.owner,
            repo: dep.repo,
            issue_number: dep.num,
            body,
        });
    }
}

function isPullRequestDetails(value: unknown): value is PullRequestDetails {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as {
        number?: unknown;
        head?: { sha?: unknown } | null;
    };

    if (typeof candidate.number !== "number") {
        return false;
    }

    if (
        typeof candidate.head !== "object" ||
        candidate.head === null ||
        typeof candidate.head.sha !== "string"
    ) {
        return false;
    }

    return true;
}

function resolvePullRequest(
    context: ProbotContext,
    payload?: EvaluationPayload,
): PullRequestDetails | undefined {
    if (payload?.pull_request) {
        return payload.pull_request;
    }

    const candidate = (context.payload as { pull_request?: unknown })
        ?.pull_request;

    if (isPullRequestDetails(candidate)) {
        return candidate;
    }

    return undefined;
}

async function isMerged(octokit: ProbotOctokit, dep: PRRef): Promise<boolean> {
    try {
        await octokit.pulls.checkIfMerged({
            owner: dep.owner,
            repo: dep.repo,
            pull_number: dep.num,
        });
        return true;
    } catch {
        return false;
    }
}

async function evaluatePR(
    app: Probot,
    context: ProbotContext,
    payload?: EvaluationPayload,
): Promise<void> {
    const { owner, repo } = context.repo();
    const pr = resolvePullRequest(context, payload);

    if (!pr) {
        context.log.info("No pull request payload available for evaluation.");
        return;
    }

    const prLabels = Array.isArray(pr.labels)
        ? pr.labels.map((label) => label?.name ?? "")
        : [];
    const hasBypass = prLabels.some((l: string) =>
        /^(prereq:deps|skip-prereq)$/.test(l || ""),
    );
    if (hasBypass) {
        await setCheckRun(context, pr, "neutral", {
            title: "PR Dependency Checks Bypassed",
            summary:
                "PR has label 'prereq:deps' or 'skip-prereq' to bypass checks.",
        });
    }

    const text = `${pr.title}\n${pr.body ?? ""}`;

    const { deps, enforce } = extractDeps(text, owner, repo);

    if (deps.length === 0) {
        await setCheckRun(context, pr, "success", {
            title: "No PR Dependencies Found",
            summary: "No PR dependencies were found in the PR.",
        });
        return;
    }

    await upsertDependentsAndDependencies(
        { owner, repo, num: pr.number },
        deps,
    );

    const cycle = await detectCycle({ owner, repo, num: pr.number });
    if (cycle.hasCycle) {
        const chain = cycle.cyclePath
            .map((c) => `${c.owner}/${c.repo}#${c.num}`)
            .join(" → ");
        await setCheckRun(context, pr, "failure", {
            title: "Circular Dependency Detected",
            summary: `A circular dependency was detected involving this PR.\n\nDependency chain:\n\n${chain}`,
        });
        return;
    }

    if (!enforce) {
        await setCheckRun(context, pr, "neutral", {
            title: "PR Dependencies Found (Not Enforced)",
            summary:
                "PR dependencies were found, but no enforcement keywords were present.",
        });
        return;
    }

    await ensureBlockingComments(
        context.octokit,
        { owner, repo, num: pr.number },
        deps,
    );

    const unmetDeps: string[] = [];
    for (const dep of deps) {
        const merged = await isMerged(context.octokit, dep);
        if (!merged) {
            let state: DepStatus = "unknown";
            try {
                const info = await context.octokit.pulls.get({
                    owner: dep.owner,
                    repo: dep.repo,
                    pull_number: dep.num,
                });
                if (info.data.draft) {
                    state = "draft";
                } else {
                    state = info.data.state === "open" ? "open" : "closed";
                }
            } catch {
                /* empty */
            }
            unmetDeps.push(
                `${dep.owner}/${dep.repo}#${dep.num} → not merged (${state})`,
            );
        }
    }

    if (unmetDeps.length === 0) {
        await setCheckRun(context, pr, "success", {
            title: "All PR Dependencies Met",
            summary: "All PR dependencies have been merged.",
        });
    } else {
        await setCheckRun(context, pr, "failure", {
            title: "Unmet PR Dependencies",
            summary: `The following PR dependencies must first be merged:\n\n${unmetDeps
                .map((d) => `- ${d}`)
                .join("\n")}`,
        });
    }
}

export default (app: Probot) => {
    // Re-evaluate when a PR changes
    app.on(
        [
            "pull_request.opened",
            "pull_request.reopened",
            "pull_request.synchronize",
            "pull_request.edited",
            "pull_request.ready_for_review",
        ],
        async (context) => {
            await evaluatePR(app, context);
        },
    );

    // Re-evaluate when an issue is edited (PR description changes)
    app.on("issues.edited", async (context) => {
        if (!context.payload.issue.pull_request) {
            return;
        }
        const { owner, repo } = context.repo();
        const prNumber = context.payload.issue.number;
        const pr = await context.octokit.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });

        await evaluatePR(app, context, { pull_request: pr.data });
    });

    // Re-evaluate dependents when a PR is merged/closed
    app.on(["pull_request.closed"], async (context) => {
        const pr = context.payload.pull_request;
        if (!pr.merged) {
            return;
        }

        const dep = {
            owner: context.payload.repository.owner.login,
            repo: context.payload.repository.name,
            num: pr.number,
        };

        const dependents = await getDependentsOf(dep);
        if (dependents.length === 0) {
            return;
        }

        const octokit = await app.auth(context.payload.installation!.id);
        for (const dependent of dependents) {
            const target = await octokit.pulls.get({
                owner: dependent.owner,
                repo: dependent.repo,
                pull_number: dependent.num,
            });

            if (!target) {
                continue;
            }

            await evaluatePR(app, context, {
                pull_request: target.data,
            });
        }
    });

    // Re-evaluate when a PR label changes
    app.on(
        ["pull_request.labeled", "pull_request.unlabeled"],
        async (context) => {
            const pr = context.payload.pull_request;
            await evaluatePR(app, context, { pull_request: pr });
        },
    );
};
