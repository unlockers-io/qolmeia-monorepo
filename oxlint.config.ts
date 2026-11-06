import { defineConfig } from "oxlint";
import awesomeness from "oxlint-config-awesomeness";
import shadcn from "oxlint-config-awesomeness/shadcn";

export default defineConfig({
  extends: [awesomeness, shadcn],
  // Generated runtime is byte-verified and tested in the control plane.
  ignorePatterns: [".github/ci/*.mjs"],
  overrides: [
    {
      files: ["packages/ui/src/lib/utils.test.ts"],
      rules: {
        "shadcn/no-unknown-classes": [
          "error",
          {
            allow: ["foo", "bar", "baz"],
          },
        ],
      },
    },
    {
      files: ["apps/agents/src/team/errors.ts"],
      rules: {
        "max-classes-per-file": "off",
      },
    },
    {
      files: ["apps/*/src/app/global-error.tsx"],
      rules: {
        "react-doctor/nextjs-global-error-missing-html-body": "off",
      },
    },
    {
      files: ["tests/e2e/**/*.ts"],
      rules: {
        "no-console": "off",
      },
    },
    {
      files: ["apps/agents/src/agents/**/*.ts", "apps/agents/src/conversation/agent.ts"],
      rules: {
        "react-hooks/rules-of-hooks": "off",
      },
    },
  ],
  rules: {
    "shadcn/no-restyle": [
      "error",
      {
        allow: ["layout"],
        contracts: [
          {
            allow: ["layout", "typography"],
            deny: ["font-*"],
            pattern: "^CardTitle$",
          },
          {
            allow: ["layout", "spacing"],
            pattern: "^CardContent$",
          },
          {
            allow: ["layout", "spacing"],
            pattern:
              "^(Card|EmptyState|CardFooter|CardHeader|AttachmentGroup|MessageScrollerContent|Marker)$",
          },
          {
            allow: ["layout", "shape"],
            pattern: "^Skeleton$",
          },
          {
            allow: ["layout", "gap-*"],
            pattern: "^DialogContent$",
          },
          {
            allow: ["layout", "spacing", "truncate"],
            pattern: "^DialogTitle$",
          },
          {
            allow: ["layout", "color"],
            pattern: "^Spinner$",
          },
        ],
      },
    ],
  },
  settings: { shadcn: { ui: "@repo/ui/components" } },
});
