import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Vitest does not read `.env` the way `next dev` does, so any spec that
// transitively imports the Prisma singleton failed at import time with
// "DATABASE_URL is not set". Load the same file Next loads before the suite
// starts; nothing here talks to the database, the value only has to exist.
config({ path: ".env" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
