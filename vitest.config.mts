import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^server-only$/,
        replacement: fileURLToPath(
          new URL("./tests/stubs/server-only.ts", import.meta.url),
        ),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL(".", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    environmentMatchGlobs: [["tests/components/**/*.test.tsx", "jsdom"]],
  },
});
