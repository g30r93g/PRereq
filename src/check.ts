import type { Context as ProbotContext } from "probot";
import crypto from "node:crypto";

import type {
    CheckRunIngestPayload,
    PullRequestForCheck,
    SetCheckRunOptions,
} from "#src/types";

const CHECK_NAME = "PRereq Checks";
const INGEST_PATH = "/ingest/check-run";

async function postCheckRunIngest(
    context: ProbotContext,
    payload: CheckRunIngestPayload,
): Promise<void> {
    const baseUrl = process.env.PREREQ_CLOUD_API_BASE_URL;
    if (!baseUrl) {
        return;
    }
    const ingestSecret = process.env.INGEST_HMAC_SECRET;
    if (!ingestSecret) {
        context.log.warn(
            "INGEST_HMAC_SECRET is not set; skipping check-run ingest.",
        );
        return;
    }

    let target: URL;
    try {
        target = new URL(INGEST_PATH, baseUrl);
    } catch (error) {
        context.log.warn(
            { err: error, baseUrl },
            "Invalid PRereq Cloud API base URL; skipping check-run ingest.",
        );
        return;
    }

    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-prereq-signature":
            "sha256=" +
            crypto
                .createHmac("sha256", ingestSecret)
                .update(body)
                .digest("hex"),
    };
    const token = process.env.PREREQ_CLOUD_API_TOKEN;
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    try {
        const response = await fetch(target, {
            method: "POST",
            headers,
            body,
        });
        if (!response.ok) {
            context.log.warn(
                {
                    status: response.status,
                    statusText: response.statusText,
                },
                "PRereq Cloud ingest endpoint responded with non-OK status.",
            );
        }
    } catch (error) {
        context.log.warn(
            { err: error },
            "Failed to post check-run ingest event to PRereq Cloud.",
        );
    }
}

export async function setCheckRun(
    context: ProbotContext,
    pr: PullRequestForCheck,
    options: SetCheckRunOptions,
): Promise<void> {
    const { owner, repo } = context.repo();
    const sha = pr.head.sha;

    await context.octokit.checks.create({
        owner,
        repo,
        name: CHECK_NAME,
        head_sha: sha,
        status: "completed",
        conclusion: options.conclusion,
        output: options.output,
    });

    type PayloadContext = {
        installation?: { id?: number | null } | null;
        repository?: { id?: number | null } | null;
    };
    const payloadContext = context.payload as PayloadContext;
    const installationId = payloadContext.installation?.id ?? null;
    const repositoryId = payloadContext.repository?.id ?? null;

    const payload: CheckRunIngestPayload = {
        owner,
        repo,
        pullNumber: pr.number,
        conclusion: options.conclusion,
        enforced: options.enforced,
        reason: options.reason ?? "unknown",
        installationId,
        repositoryId,
        checkName: CHECK_NAME,
        timestamp: new Date().toISOString(),
    };

    void postCheckRunIngest(context, payload);
}
