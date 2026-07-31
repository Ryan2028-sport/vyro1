import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Visible fallback so a crash inside any route (or a provider it mounts)
 * never renders as a blank white screen.
 */
function DefaultErrorComponent({ error }: { error: Error }) {
  console.error(error);
  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</h1>
      <p style={{ marginTop: 8, opacity: 0.75, fontSize: 14 }}>
        {error?.message ?? "Unknown error"}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{ marginTop: 16, padding: "8px 14px", borderRadius: 8 }}
      >
        Reload
      </button>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};

