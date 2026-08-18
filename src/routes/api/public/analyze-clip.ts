import { createFileRoute } from "@tanstack/react-router";
import { ClipInputSchema } from "@/lib/video-analysis-core";
import { runClipAnalysis } from "@/lib/video-analysis.server";

// External HTTP entry point for the squash clip analyser. Shares the exact
// schema and pipeline used by the in-app server function.
export const Route = createFileRoute("/api/public/analyze-clip")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const parsed = ClipInputSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid payload", issues: parsed.error.issues.slice(0, 8) },
            { status: 400 },
          );
        }

        const result = await runClipAnalysis(parsed.data);
        return Response.json(result, { status: result.error && !result.insight ? 502 : 200 });
      },
    },
  },
});
