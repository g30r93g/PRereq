import type { UserConfig } from "@commitlint/types";

const Configuration: UserConfig = {
  // Conventional Commits base rules
  extends: ["@commitlint/config-conventional"],

  // Optional: custom parsing if you want explicit breaking marker capture
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/,
      headerCorrespondence: ["type", "scope", "breaking", "subject"],
    },
  },

  // Ignore certain messages (e.g., version bumps, merges)
  // Add others if your tooling generates commits.
  ignores: [
    (msg) => /^v?\d+\.\d+\.\d+/.test(msg), // version tags like v1.2.3
    (msg) => msg.startsWith("Merge "),
  ],

  rules: {
    // Allowed types. Add your own if needed.
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
        "undo",
        "wip",
        "deps",
        "config",
        "hotfix",
      ],
    ],

    // Keep headers readable
    "header-max-length": [2, "always", 100],

    // Subjects shouldn’t start with capitals or end with periods
    "subject-case": [
      2,
      "never",
      ["sentence-case", "start-case", "pascal-case", "upper-case"],
    ],
    "subject-full-stop": [2, "never", "."],

    // Enforce a blank line before body/footer when present
    "body-leading-blank": [2, "always"],
    "footer-leading-blank": [2, "always"],

    // If you want to *require* a scope, flip this to [2, 'never'] → false
    "scope-empty": [0, "never"],
  },
};

export default Configuration;
