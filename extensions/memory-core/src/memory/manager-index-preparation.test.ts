import { INVALID_PROJECT_ANNOTATION_KEY } from "openclaw/plugin-sdk/memory-core-host-engine-storage";
import { describe, expect, it } from "vitest";
import { prepareMemoryIndexChunks } from "./manager-index-preparation.js";

describe("memory index preparation", () => {
  it.each([undefined, { id: "openai" }])(
    "prepares incomplete and mixed annotations promptly with provider %j",
    (provider) => {
      const content = [
        "- Alpha mixed. <!--trigger: alpha --><!-- note --> prose <!--importance: 3 --><!--project: alpha-key -->",
        "- Beta nontrailing. <!--trigger: ignored --> ordinary text",
        "- Gamma nested. <!--trigger: <!--project: gamma-key -->",
        `- Incomplete. <!--trigger:${"--><!--project:".repeat(26)}X`,
      ].join("\n");

      // Guard the original backtracking witness through the complete CPU preparation
      // path; index.test.ts covers worker publication, SQLite, search, and embeddings.
      const started = performance.now();
      const { chunks } = prepareMemoryIndexChunks({
        entry: { path: "MEMORY.md", mtimeMs: 1 },
        source: "memory",
        content,
        pathClassification: { curatedRoot: true, originClass: "agent" },
        chunking: { tokens: 400, overlap: 80 },
        provider,
        hardMaxInputTokens: 8_000,
      });
      expect(performance.now() - started).toBeLessThan(3_000);
      expect(chunks).toMatchObject([
        {
          text: "- Alpha mixed. <!-- note --> prose",
          triggers: "alpha",
          importance: 3,
          projectKey: "alpha-key",
        },
        {
          text: "- Beta nontrailing.  ordinary text",
          triggers: null,
          importance: null,
          projectKey: null,
        },
        {
          text: "- Gamma nested.",
          triggers: "<!--project: gamma-key",
          importance: null,
          projectKey: "gamma-key",
        },
        {
          text: "- Incomplete. <!--project:X",
          triggers: null,
          importance: null,
          projectKey: INVALID_PROJECT_ANNOTATION_KEY,
        },
      ]);
    },
  );
});
