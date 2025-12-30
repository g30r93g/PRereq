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

export type PullRequestForCheck = Pick<PullRequestDetails, "head" | "number">;

export type EvaluationPayload = {
    pull_request: PullRequestDetails;
};

export type ExtractedDeps = {
    deps: PRRef[];
    enforce: boolean;
};

export type CheckRunReason =
    | "bypass-label"
    | "no-dependencies"
    | "non-enforced"
    | "dependencies-met"
    | "dependencies-unmet"
    | "dependency-cycle"
    | "unknown";

export type CheckRunIngestPayload = {
    installationId: number;
    orgLogin: string;
    repo: string;
    prNumber: number;
    headSha: string;
    conclusion: "success" | "failure" | "neutral";
    createdAt: string;
};

export type SetCheckRunOptions = {
    conclusion: "success" | "failure" | "neutral";
    output: { title: string; summary: string };
    enforced: boolean;
    reason?: CheckRunReason;
};

export type CycleResult =
    | { hasCycle: false }
    | { hasCycle: true; cyclePath: PRRef[] };

export type DependencyStatusResult = {
    merged: boolean;
    state: DepStatus;
};

export type DependencyStatusResolver = (
    dep: PRRef,
) => Promise<DependencyStatusResult>;

export type BlockingCommentHandler = (
    dependent: PRRef,
    deps: PRRef[],
) => Promise<void>;

export type DependencyStorage = {
    upsertDependentsAndDependencies(
        dependent: PRRef,
        deps: PRRef[],
    ): Promise<void>;
};

export type CycleDetector = (start: PRRef) => Promise<CycleResult>;

export type CheckRunReporter = (options: SetCheckRunOptions) => Promise<void>;

export type EvaluatePullRequestServices = {
    storage: DependencyStorage;
    detectCycle: CycleDetector;
    ensureBlockingComments: BlockingCommentHandler;
    resolveDependencyStatus: DependencyStatusResolver;
    reportCheckRun: CheckRunReporter;
};

export type EvaluatePullRequestParams = {
    repo: { owner: string; name: string };
    pullRequest: PullRequestDetails;
    services: EvaluatePullRequestServices;
};
