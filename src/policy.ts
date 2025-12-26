import type { Context as ProbotContext } from "probot";

type PolicyDecision = {
    allowChecks: boolean;
    allowComments: boolean;
    reason?: string;
};

const DEFAULT_DECISION: PolicyDecision = {
    allowChecks: true,
    allowComments: true,
};

export async function fetchPolicyDecision(
    context: ProbotContext,
): Promise<PolicyDecision> {
    const baseUrl = process.env.PREREQ_CLOUD_API_BASE_URL;
    if (!baseUrl) {
        return DEFAULT_DECISION;
    }

    const orgLogin = context.repo().owner;
    const payload = context.payload as
        | { installation?: { id?: number | null } }
        | undefined;
    const installationId = payload?.installation?.id ?? null;
    const day = new Date().toISOString().slice(0, 10);

    let target: URL;
    try {
        target = new URL("/policy/decision", baseUrl);
    } catch (error) {
        context.log.warn(
            { err: error, baseUrl },
            "Invalid PRereq Cloud API base URL; skipping policy decision.",
        );
        return DEFAULT_DECISION;
    }

    const headers: Record<string, string> = {
        "content-type": "application/json",
    };
    const token = process.env.PREREQ_CLOUD_API_TOKEN;
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    try {
        const response = await fetch(target, {
            method: "POST",
            headers,
            body: JSON.stringify({
                installationId,
                orgLogin,
                day,
            }),
        });
        if (!response.ok) {
            context.log.warn(
                {
                    status: response.status,
                    statusText: response.statusText,
                },
                "PRereq Cloud policy endpoint responded with non-OK status.",
            );
            return DEFAULT_DECISION;
        }
        const decision = (await response.json()) as PolicyDecision;
        const normalized: PolicyDecision = {
            allowChecks:
                typeof decision.allowChecks === "boolean"
                    ? decision.allowChecks
                    : DEFAULT_DECISION.allowChecks,
            allowComments:
                typeof decision.allowComments === "boolean"
                    ? decision.allowComments
                    : DEFAULT_DECISION.allowComments,
            reason: decision.reason,
        };
        // future: consider caching policy decisions once we have performance metrics.
        return normalized;
    } catch (error) {
        context.log.warn(
            { err: error },
            "Failed to fetch PRereq Cloud policy decision.",
        );
        return DEFAULT_DECISION;
    }
}
