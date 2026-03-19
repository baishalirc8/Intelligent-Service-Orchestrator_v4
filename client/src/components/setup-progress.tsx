import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, X, Users, Radio, Server, BarChart3, Lightbulb, CircleDot } from "lucide-react";

const DISMISSED_KEY = "holocron-setup-progress-dismissed";

interface SetupCheck {
  key: string;
  label: string;
  icon: typeof Users;
  completed: boolean;
}

export function SetupProgress() {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(DISMISSED_KEY) === "true";
  });

  const { data: subscriptions } = useQuery<any[]>({
    queryKey: ["/api/role-subscriptions"],
    enabled: !dismissed,
  });

  const { data: probes } = useQuery<any[]>({
    queryKey: ["/api/discovery-probes"],
    enabled: !dismissed,
  });

  const { data: metrics } = useQuery<any[]>({
    queryKey: ["/api/device-metrics"],
    enabled: !dismissed,
  });

  const { data: recommendations } = useQuery<any[]>({
    queryKey: ["/api/recommendations"],
    enabled: !dismissed,
  });

  useEffect(() => {
    if (dismissed) {
      localStorage.setItem(DISMISSED_KEY, "true");
    }
  }, [dismissed]);

  if (dismissed) return null;

  const enrolledProbes = Array.isArray(probes) ? probes.filter((p: any) => p.enrolled) : [];

  const checks: SetupCheck[] = [
    { key: "agents", label: "AI agents subscribed", icon: Users, completed: Array.isArray(subscriptions) && subscriptions.length > 0 },
    { key: "probes", label: "Probes configured", icon: Radio, completed: Array.isArray(probes) && probes.length > 0 },
    { key: "enrolled", label: "Probe enrolled", icon: Server, completed: enrolledProbes.length > 0 },
    { key: "metrics", label: "Metrics assigned", icon: BarChart3, completed: Array.isArray(metrics) && metrics.length > 0 },
    { key: "insights", label: "Insights generated", icon: Lightbulb, completed: Array.isArray(recommendations) && recommendations.length > 0 },
  ];

  const completedCount = checks.filter((c) => c.completed).length;
  const progressPercent = Math.round((completedCount / checks.length) * 100);

  if (progressPercent === 100) return null;

  const progressColor = progressPercent >= 80 ? "text-emerald-400" : progressPercent >= 40 ? "text-amber-400" : "text-primary";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/40 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
          data-testid="button-setup-progress"
          title="Setup Progress"
        >
          <CircleDot className={`h-3 w-3 ${progressColor}`} />
          <span className={`text-[10px] font-bold ${progressColor}`}>{progressPercent}%</span>
          <span className="text-[9px] text-muted-foreground hidden sm:inline">setup</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3" data-testid="popover-setup-progress">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold">Platform Setup</span>
          <span className={`text-xs font-bold ${progressColor}`}>{completedCount}/{checks.length}</span>
        </div>
        <Progress value={progressPercent} className="h-1.5 mb-3" data-testid="progress-setup" />

        <div className="space-y-1.5">
          {checks.map((check) => {
            const Icon = check.icon;
            return (
              <div key={check.key} className="flex items-center gap-2" data-testid={`row-setup-${check.key}`}>
                <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className={`text-[11px] flex-1 ${check.completed ? "text-muted-foreground line-through" : ""}`}>
                  {check.label}
                </span>
                {check.completed ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <X className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3 h-6 text-[10px] text-muted-foreground"
          onClick={() => setDismissed(true)}
          data-testid="button-dismiss-setup"
        >
          Dismiss
        </Button>
      </PopoverContent>
    </Popover>
  );
}
