import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Loader2, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RoleSubscription, OrgRole, UserManagedAgent } from "@shared/schema";

export function AgentAccessManager() {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: subscriptions } = useQuery<RoleSubscription[]>({
    queryKey: ["/api/role-subscriptions"],
  });

  const { data: roles } = useQuery<OrgRole[]>({
    queryKey: ["/api/org-roles"],
  });

  const { data: managedAgents, isLoading: loadingManaged } = useQuery<UserManagedAgent[]>({
    queryKey: ["/api/managed-agents"],
  });

  const aiSubs = subscriptions?.filter(s => s.hasAiShadow && s.status === "active") ?? [];

  useEffect(() => {
    if (managedAgents && open) {
      setSelectedIds(new Set(managedAgents.map(m => m.agentRoleId)));
    }
  }, [managedAgents, open]);

  const saveMutation = useMutation({
    mutationFn: async (agentRoleIds: string[]) => {
      await apiRequest("PUT", "/api/managed-agents", { agentRoleIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managed-agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-performance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-notifications"] });
      toast({ title: "Agent access updated" });
      setOpen(false);
    },
  });

  const toggleAgent = (roleId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const handleSave = () => {
    saveMutation.mutate(Array.from(selectedIds));
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(aiSubs.map(s => s.roleId)));
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
  };

  const isAllAccess = !managedAgents || managedAgents.length === 0;
  const managedCount = managedAgents?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-agent-access">
          <Shield className="h-3.5 w-3.5" />
          Agent Access
          {!isAllAccess && (
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 h-4">
              {managedCount}/{aiSubs.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-access-title">Agent Access Control</DialogTitle>
          <DialogDescription>
            Select which AI agents you have authority to manage. When no agents are selected, you have access to all agents.
          </DialogDescription>
        </DialogHeader>

        {loadingManaged ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {selectedIds.size === 0
                  ? "Full access (all agents)"
                  : `${selectedIds.size} of ${aiSubs.length} agents selected`}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleSelectAll} data-testid="button-select-all">
                  Select all
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClearAll} data-testid="button-clear-all">
                  Clear (full access)
                </Button>
              </div>
            </div>

            <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
              {aiSubs.map(sub => {
                const role = roles?.find(r => r.id === sub.roleId);
                if (!role) return null;
                const isChecked = selectedIds.has(sub.roleId);
                return (
                  <label
                    key={sub.roleId}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isChecked ? "border-primary/40 bg-primary/5" : "border-border hover:bg-accent/30"
                    }`}
                    data-testid={`agent-access-${sub.roleId}`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleAgent(sub.roleId)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{role.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{role.department}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} data-testid="button-access-cancel">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-access-save">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Access"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
