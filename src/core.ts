import { extractDeps } from "#src/parse";
import type { DepStatus, EvaluatePullRequestParams, PRRef } from "#src/types";

const BYPASS_LABEL = /^(prereq:deps|skip-prereq)$/;

function normalizeLabels(
    labels: EvaluatePullRequestParams["pullRequest"]["labels"],
): string[] {
    if (!Array.isArray(labels)) {
        return [];
    }
    return labels.map((label) => label?.name ?? "").filter(Boolean);
}

function formatDependencyState(dep: PRRef, state: DepStatus): string {
    return `${dep.owner}/${dep.repo}#${dep.num} → not merged (${state})`;
}

export async function evaluatePullRequest(
    params: EvaluatePullRequestParams,
): Promise<void> {
    const {
        repo,
        pullRequest,
        services: {
            reportCheckRun,
            storage,
            detectCycle,
            ensureBlockingComments,
            resolveDependencyStatus,
        },
    } = params;

    const labels = normalizeLabels(pullRequest.labels);
    const hasBypass = labels.some((label) => BYPASS_LABEL.test(label || ""));
    if (hasBypass) {
        await reportCheckRun({
            conclusion: "neutral",
            enforced: false,
            reason: "bypass-label",
            output: {
                title: "PR Dependency Checks Bypassed",
                summary:
                    "PR has label 'prereq:deps' or 'skip-prereq' to bypass checks.",
            },
        });
    }

    const text = `${pullRequest.title}\n${pullRequest.body ?? ""}`;
    const { deps, enforce } = extractDeps(text, repo.owner, repo.name);

    if (deps.length === 0) {
        await reportCheckRun({
            conclusion: "success",
            enforced: false,
            reason: "no-dependencies",
            output: {
                title: "No PR Dependencies Found",
                summary: "No PR dependencies were found in the PR.",
            },
        });
        return;
    }

    const dependent: PRRef = {
        owner: repo.owner,
        repo: repo.name,
        num: pullRequest.number,
    };

    await storage.upsertDependentsAndDependencies(dependent, deps);

    const cycle = await detectCycle(dependent);
    if (cycle.hasCycle) {
        const chain = cycle.cyclePath
            .map((c) => `${c.owner}/${c.repo}#${c.num}`)
            .join(" → ");
        await reportCheckRun({
            conclusion: "failure",
            enforced: true,
            reason: "dependency-cycle",
            output: {
                title: "Circular Dependency Detected",
                summary: `A circular dependency was detected involving this PR.\n\nDependency chain:\n\n${chain}`,
            },
        });
        return;
    }

    if (!enforce) {
        await reportCheckRun({
            conclusion: "neutral",
            enforced: false,
            reason: "non-enforced",
            output: {
                title: "PR Dependencies Found (Not Enforced)",
                summary:
                    "PR dependencies were found, but no enforcement keywords were present.",
            },
        });
        return;
    }

    await ensureBlockingComments(dependent, deps);

    const unmetDeps: string[] = [];
    for (const dep of deps) {
        const status = await resolveDependencyStatus(dep);
        if (!status.merged) {
            unmetDeps.push(formatDependencyState(dep, status.state));
        }
    }

    if (unmetDeps.length === 0) {
        await reportCheckRun({
            conclusion: "success",
            enforced: true,
            reason: "dependencies-met",
            output: {
                title: "All PR Dependencies Met",
                summary: "All PR dependencies have been merged.",
            },
        });
        return;
    }

    await reportCheckRun({
        conclusion: "failure",
        enforced: true,
        reason: "dependencies-unmet",
        output: {
            title: "Unmet PR Dependencies",
            summary: `The following PR dependencies must first be merged:\n\n${unmetDeps
                .map((d) => `- ${d}`)
                .join("\n")}`,
        },
    });
}
