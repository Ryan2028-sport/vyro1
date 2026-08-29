import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRoles } from "@/lib/roles.functions";

/** Roles for the signed-in user. Debug tooling is admin-only. */
export function useRoles() {
  const fetchRoles = useServerFn(getMyRoles);
  const query = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => fetchRoles(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return {
    roles: query.data?.roles ?? [],
    isAdmin: query.data?.isAdmin === true,
    isLoading: query.isLoading,
  };
}
