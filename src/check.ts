import type { Context as ProbotContext } from "probot";

import type { PullRequestForCheck } from "#src/types";

export async function setCheckRun(
    context: ProbotContext,
    pr: PullRequestForCheck,
    conclusion: "success" | "failure" | "neutral",
    output: { title: string; summary: string },
) {
    const { owner, repo } = context.repo();
    const sha = pr.head.sha;

    await context.octokit.checks.create({
        owner,
        repo,
        name: "PRereq Checks",
        head_sha: sha,
        status: "completed",
        conclusion,
        output,
    });
}
