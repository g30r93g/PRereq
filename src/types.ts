export type PRRef = { owner: string; repo: string; num: number };

export type DepStatus = "merged" | "open" | "closed" | "draft" | "unknown";

export type PullRequestLabel = { name?: string | null } | null;

export type PullRequestDetails = {
    number: number;
    title: string;
    body: string | null;
    labels?: PullRequestLabel[] | null;
    merged: boolean | null;
    head: { sha: string };
};

export type PullRequestForCheck = Pick<PullRequestDetails, "head">;

export type EvaluationPayload = {
    pull_request: PullRequestDetails;
};

export type ExtractedDeps = {
    deps: PRRef[];
    enforce: boolean;
};
