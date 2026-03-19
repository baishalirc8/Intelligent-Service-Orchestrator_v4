import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { resolveEnabledModules, resolveEnabledDomains, getRequiredByNames, DOMAINS } from "@/lib/modules";

export function useModules() {
  const queryClient = useQueryClient();

  const { data: prefs = {}, isLoading } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/user/module-preferences"],
    select: (data: any) => data?.preferences ?? {},
  });

  const mutation = useMutation({
    mutationFn: async (newPrefs: Record<string, boolean>) => {
      await apiRequest("PUT", "/api/user/module-preferences", { preferences: newPrefs });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/module-preferences"] });
    },
  });

  const enabledModules = resolveEnabledModules(prefs);
  const enabledDomains = resolveEnabledDomains(prefs);

  function isEnabled(moduleId: string): boolean {
    return enabledModules.has(moduleId);
  }

  function isDomainEnabled(domainId: string): boolean {
    return enabledDomains.has(domainId);
  }

  /** Names of currently-enabled domains that require this domain to stay on */
  function requiredBy(domainId: string): string[] {
    return getRequiredByNames(domainId, prefs);
  }

  /** True if this domain cannot be turned off because another enabled domain depends on it */
  function isDomainLocked(domainId: string): boolean {
    const domain = DOMAINS.find(d => d.id === domainId);
    if (domain?.alwaysOn) return true;
    return requiredBy(domainId).length > 0;
  }

  function applyPrefs(next: Record<string, boolean>) {
    mutation.mutate(next);
    queryClient.setQueryData(["/api/user/module-preferences"], { preferences: next });
  }

  function setDomain(domainId: string, enabled: boolean) {
    const domain = DOMAINS.find(d => d.id === domainId);
    if (!domain || domain.alwaysOn) return;
    if (!enabled && isDomainLocked(domainId)) return; // blocked by dependency
    applyPrefs({ ...prefs, [domainId]: enabled });
  }

  function setModule(moduleId: string, enabled: boolean) {
    applyPrefs({ ...prefs, [moduleId]: enabled });
  }

  function enableAll() {
    const next: Record<string, boolean> = {};
    for (const d of DOMAINS) {
      if (!d.alwaysOn) next[d.id] = true;
    }
    applyPrefs(next);
  }

  function resetToMinimum() {
    const next: Record<string, boolean> = {};
    for (const d of DOMAINS) {
      if (!d.alwaysOn) next[d.id] = false;
    }
    applyPrefs(next);
  }

  return {
    prefs,
    isEnabled,
    isDomainEnabled,
    isDomainLocked,
    requiredBy,
    setDomain,
    setModule,
    enableAll,
    resetToMinimum,
    isLoading,
    isSaving: mutation.isPending,
  };
}
