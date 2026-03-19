import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sparkles, ChevronRight, ChevronDown, UserPlus, Loader2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const MODULE_AGENTS: Record<string, string[]> = {
  cspm: [
    "Cloud Security Platform Engineer",
    "Security Integrations Architect",
    "Cloud Security Engineer",
    "Director of Security Platform Engineering",
  ],
  edr: [
    "EDR Platform Engineer",
    "Endpoint Security Engineer",
    "Security Platform Engineer",
    "Security Automation Engineer",
  ],
  soc: [
    "SOC Manager",
    "SOC Analyst Level 2",
    "SOC Analyst Level 3 / Threat Hunter",
    "SIEM Engineer",
    "SIEM & SOAR Integration Engineer",
    "Threat Intelligence Analyst",
  ],
  incidents: [
    "Incident Response Lead",
    "Digital Forensics Analyst",
    "Security Automation Engineer",
    "SOC Analyst Level 3 / Threat Hunter",
  ],
  iam: [
    "IAM Architect",
    "Senior IAM Engineer",
    "PAM Engineer",
    "IAM & DLP Integration Engineer",
    "MFA Specialist",
  ],
  compliance: [
    "Director of GRC",
    "GRC Manager",
    "Compliance Analyst (SOC 2)",
    "Compliance Analyst (ISO 27001 / GDPR)",
    "Audit Coordinator",
  ],
  "risk-register": [
    "Risk Analyst",
    "Senior Risk Analyst",
    "Director of Risk Management",
    "Policy & Standards Writer",
  ],
  "data-protection": [
    "DLP Engineer",
    "IAM & DLP Integration Engineer",
    "Security Platform Engineer",
    "Privacy Officer",
  ],
  awareness: [
    "Email Security Engineer",
    "SOC Analyst Level 1",
    "Policy & Standards Writer",
  ],
  integrations: [
    "Director of Security Platform Engineering",
    "Security Integrations Architect",
    "Security Platform Engineer",
    "Security Automation Engineer",
    "Security Tooling Analyst",
    "SIEM & SOAR Integration Engineer",
    "EDR Platform Engineer",
    "Cloud Security Platform Engineer",
    "IAM & DLP Integration Engineer",
  ],
  siem: [
    "SIEM Engineer",
    "SIEM & SOAR Integration Engineer",
    "SOC Manager",
    "Threat Intelligence Analyst",
    "Log Management Engineer",
    "Security Automation Engineer",
    "Security Integrations Architect",
  ],
  "threat-intelligence": [
    "Threat Intelligence Analyst",
    "SOC Analyst Level 3 / Threat Hunter",
    "Security Integrations Architect",
  ],
  "vulnerability-management": [
    "Vulnerability Management Analyst",
    "Cloud Security Engineer",
    "Security Automation Engineer",
  ],
  "pentest-management": [
    "Penetration Tester",
    "Senior Security Architect",
    "SOC Analyst Level 3 / Threat Hunter",
  ],
};

function SubscribeDialog({
  role, open, onOpenChange,
}: {
  role: any; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [humanName, setHumanName] = useState("");
  const [humanEmail, setHumanEmail] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/role-subscriptions", {
        roleId: role.id,
        assignedHumanName: humanName.trim() || "Unassigned",
        assignedHumanEmail: humanEmail.trim() || null,
        hasAiShadow: true,
        status: "active",
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-subscriptions"] });
      toast({ title: "Agent activated", description: `${role.name} is now part of your team` });
      onOpenChange(false);
      setHumanName("");
      setHumanEmail("");
    },
    onError: (e: any) => toast({ title: "Failed to activate", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Activate AI Agent
          </DialogTitle>
          <DialogDescription className="text-xs">
            Assign <span className="font-semibold text-foreground">{role?.name}</span> to a human team member they will shadow and augment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground/70">Human Team Member Name <span className="text-red-400">*</span></Label>
            <Input
              className="h-8 text-xs"
              placeholder="e.g. Sarah Chen"
              value={humanName}
              onChange={e => setHumanName(e.target.value)}
              data-testid="input-subscribe-human-name"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground/70">Email (optional)</Label>
            <Input
              className="h-8 text-xs"
              placeholder="sarah.chen@corp.com"
              value={humanEmail}
              onChange={e => setHumanEmail(e.target.value)}
              data-testid="input-subscribe-human-email"
            />
          </div>
          {role && (
            <div className="rounded-lg bg-primary/5 border border-primary/15 p-2.5 text-[10px] text-muted-foreground/70">
              <p className="font-semibold text-primary/80 mb-1">AI Capabilities</p>
              <ul className="space-y-0.5">
                {(role.aiCapabilities ?? []).slice(0, 4).map((cap: string) => (
                  <li key={cap} className="flex items-center gap-1.5">
                    <Sparkles className="h-2.5 w-2.5 text-primary/50 shrink-0" />{cap}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            size="sm" className="h-7 text-xs gap-1.5"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            data-testid="button-confirm-subscribe"
          >
            {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
            Activate Agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SuggestedAgentsPanel({ module }: { module: string }) {
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);

  const suggestedNames = MODULE_AGENTS[module] ?? [];

  const { data: allRoles = [] } = useQuery<any[]>({
    queryKey: ["/api/org-roles"],
    enabled: suggestedNames.length > 0,
  });

  const { data: subscriptions = [] } = useQuery<any[]>({
    queryKey: ["/api/role-subscriptions"],
  });

  const subscribedRoleIds = new Set(subscriptions.map((s: any) => s.roleId));
  const hasAnySubscription = subscriptions.length > 0;

  const suggestions = allRoles.filter(
    r => suggestedNames.includes(r.name) && !subscribedRoleIds.has(r.id)
  );

  if (!hasAnySubscription || suggestions.length === 0 || dismissed) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/4 overflow-hidden" data-testid="suggested-agents-panel">
      <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-primary/5 transition-colors">
        <button
          className="flex items-center gap-2 flex-1 min-w-0"
          onClick={() => setExpanded(e => !e)}
          data-testid="button-toggle-suggestions"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold text-primary flex-1 text-left">
            Suggested AI Agents for this module
          </span>
          <Badge className="text-[9px] px-1.5 py-0 bg-primary/15 text-primary border-primary/20 border shrink-0">
            {suggestions.length} available
          </Badge>
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-primary/60 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-primary/60 shrink-0" />}
        </button>
        <button
          className="text-muted-foreground/40 hover:text-muted-foreground p-0.5 rounded shrink-0"
          onClick={() => setDismissed(true)}
          data-testid="button-dismiss-suggestions"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3">
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
            {suggestions.map(role => (
              <div
                key={role.id}
                className="shrink-0 w-52 rounded-lg border border-border/40 bg-card/80 p-3 flex flex-col gap-2"
                data-testid={`suggestion-card-${role.id}`}
              >
                <div>
                  <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{role.name}</p>
                  <p className="text-[9px] text-muted-foreground/50 mt-0.5">{role.division ?? role.department}</p>
                </div>
                <div className="flex-1 space-y-0.5">
                  {(role.aiCapabilities ?? []).slice(0, 3).map((cap: string) => (
                    <div key={cap} className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
                      <Sparkles className="h-2 w-2 text-primary/40 shrink-0" />
                      <span className="truncate">{cap}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] text-muted-foreground/40 font-mono">
                    ${(role.monthlyPrice ?? 0).toLocaleString()}/mo
                  </span>
                  <Button
                    size="sm"
                    className="h-6 text-[10px] px-2 gap-1"
                    onClick={() => setSelectedRole(role)}
                    data-testid={`button-add-agent-${role.id}`}
                  >
                    <UserPlus className="h-2.5 w-2.5" /> Add
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground/35 mt-2">
            These agents are suggested based on this module's capabilities. Only showing agents not yet in your team.
          </p>
        </div>
      )}

      {selectedRole && (
        <SubscribeDialog
          role={selectedRole}
          open={!!selectedRole}
          onOpenChange={v => { if (!v) setSelectedRole(null); }}
        />
      )}
    </div>
  );
}
