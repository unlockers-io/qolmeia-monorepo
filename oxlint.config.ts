import { defineConfig } from "oxlint";
import awesomeness from "oxlint-config-awesomeness";

export default defineConfig({
  extends: [awesomeness],
  jsPlugins: ["@shadcn/lint"],
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
      files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
      rules: {
        "new-cap": [
          "error",
          {
            capIsNewExceptions: ["Inter", "Hanken_Grotesk", "Sora", "JetBrains_Mono", "Scalar"],
          },
        ],
      },
    },
    {
      files: [
        "apps/backoffice/src/proxy.ts",
        "apps/backoffice/src/lib/auth-helpers.ts",
        "apps/backoffice/src/components/sign-out-button.tsx",
        "apps/web/src/proxy.ts",
        "apps/web/src/lib/auth-helpers.ts",
        "apps/web/src/components/sign-out-button.tsx",
        "apps/web/src/app/auth/verify/page.tsx",
        "apps/web/src/app/(client)/page.tsx",
        "apps/web/src/app/(client)/assets/page.tsx",
        "apps/web/src/app/(client)/activity/page.tsx",
        "packages/auth/src/server.ts",
      ],
      rules: {
        "no-console": "off",
      },
    },
    {
      files: ["apps/api/src/scripts/**/*.ts"],
      rules: {
        "no-console": "off",
        "unicorn/no-process-exit": "off",
      },
    },
    {
      files: ["apps/agents/src/team/errors.ts"],
      rules: {
        "max-classes-per-file": "off",
      },
    },
    {
      files: ["tests/e2e/**/*.ts"],
      rules: {
        "no-console": "off",
        "require-unicode-regexp": "off",
      },
    },
    {
      files: ["apps/agents/src/agents/**/*.ts"],
      rules: {
        "react-hooks/rules-of-hooks": "off",
      },
    },
  ],
  rules: {
    "shadcn/no-arbitrary-values": "error",
    "shadcn/no-inline-styles": "error",
    "shadcn/no-raw-colors": "error",
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
    "shadcn/no-unknown-classes": "error",
    "shadcn/require-static-classes": "error",
  },
  settings: { shadcn: { ui: "@repo/ui/components" } },
});
