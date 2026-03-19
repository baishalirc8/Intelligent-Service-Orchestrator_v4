import { useState } from "react";
import { DOMAINS, COLOR_MAP, type DomainDef } from "@/lib/modules";
import { useModules } from "@/hooks/use-modules";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Lock, Check, Loader2, LayoutGrid, Zap, ChevronDown, ChevronRight, Link2 } from "lucide-react";
import holocronLogo from "@assets/Holocron_Logo_Icon_White_1772663128663.png";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function DomainCard({ domain, isDomainEnabled, isDomainLocked, requiredBy, isModuleEnabled, onDomainToggle, onModuleToggle }: {
  domain: DomainDef;
  isDomainEnabled: boolean;
  isDomainLocked: boolean;
  requiredBy: string[];
  isModuleEnabled: (id: string) => boolean;
  onDomainToggle: (enabled: boolean) => void;
  onModuleToggle: (id: string, enabled: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const colors = COLOR_MAP[domain.color] || COLOR_MAP["indigo"];
  const enabledCount = domain.modules.filter(m => isModuleEnabled(m.id)).length;
  const Icon = domain.icon;
  const isLocked = domain.alwaysOn || isDomainLocked;

  return (
    <div
      className={cn(
        "relative rounded-2xl border transition-all duration-300 overflow-hidden",
        "bg-card/60 backdrop-blur-sm",
        isDomainEnabled || domain.alwaysOn
          ? `${colors.border} shadow-lg`
          : "border-border/30 opacity-60",
      )}
    >
      {/* Top gradient accent bar */}
      <div className={cn("h-1 w-full bg-gradient-to-r", domain.gradient, "opacity-80")} />

      {/* Card body */}
      <div className="p-4 sm:p-5">
        {/* Header row: icon + name + toggle */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn("flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl shrink-0", colors.bg)}>
              <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", colors.text)} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-sm font-bold text-foreground leading-tight">{domain.name}</h3>
                {domain.alwaysOn ? (
                  <Badge className="text-[9px] px-1.5 py-0 h-4 bg-indigo-500/20 text-indigo-300 border-0 shrink-0">
                    <Lock className="h-2.5 w-2.5 mr-0.5" /> Core
                  </Badge>
                ) : (
                  <Badge className={cn("text-[9px] px-1.5 py-0 h-4 border-0 shrink-0", colors.badge)}>
                    {domain.tagline}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground/70 mt-1 leading-relaxed">
                {domain.description}
              </p>
            </div>
          </div>

          {/* Toggle or lock indicator */}
          {domain.alwaysOn ? (
            <div className="shrink-0 flex items-center gap-1 mt-0.5">
              <Check className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-[10px] text-indigo-400 font-medium hidden sm:inline">Always on</span>
            </div>
          ) : isDomainLocked ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="shrink-0 flex items-center gap-1 mt-0.5 cursor-not-allowed">
                  <Link2 className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[10px] text-amber-400 font-medium hidden sm:inline">Required</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs max-w-[200px]">
                Required by: {requiredBy.join(", ")}. Disable those domains first.
              </TooltipContent>
            </Tooltip>
          ) : (
            <Switch
              checked={isDomainEnabled}
              onCheckedChange={onDomainToggle}
              className="shrink-0 mt-0.5 data-[state=checked]:bg-primary"
              data-testid={`switch-domain-${domain.id}`}
            />
          )}
        </div>

        {/* Required-by dependency notice */}
        {requiredBy.length > 0 && (
          <div className="mt-3 flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Link2 className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-300/90 leading-snug">
              Required by <span className="font-semibold">{requiredBy.join(" & ")}</span> — cannot be disabled while those domains are active.
            </p>
          </div>
        )}

        {/* Domain requires notice (this domain depends on something) */}
        {domain.requiredDomains && domain.requiredDomains.length > 0 && isDomainEnabled && !domain.alwaysOn && (
          <div className="mt-3 flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/30 border border-border/40">
            <Link2 className="h-3 w-3 text-muted-foreground/50 shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground/50 leading-snug">
              Requires: <span className="font-medium text-muted-foreground/70">
                {domain.requiredDomains.map(id => DOMAINS.find(d => d.id === id)?.name).filter(Boolean).join(", ")}
              </span>
            </p>
          </div>
        )}

        {/* Module count + expand toggle */}
        <div className="flex items-center justify-between mt-4">
          <span className={cn("text-[11px] font-medium", isDomainEnabled || domain.alwaysOn ? colors.text : "text-muted-foreground/40")}>
            {enabledCount} / {domain.modules.length} modules active
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            {expanded ? (
              <><ChevronDown className="h-3 w-3" /> Hide</>
            ) : (
              <><ChevronRight className="h-3 w-3" /> Details</>
            )}
          </button>
        </div>

        {/* Module pill preview (collapsed) */}
        {!expanded && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {domain.modules.slice(0, 4).map(m => (
              <span
                key={m.id}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border",
                  isModuleEnabled(m.id)
                    ? `${colors.bg} ${colors.text} ${colors.border}`
                    : "bg-muted/20 text-muted-foreground/30 border-border/20"
                )}
              >
                {m.name}
              </span>
            ))}
            {domain.modules.length > 4 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/20 text-muted-foreground/40 border border-border/20">
                +{domain.modules.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Expanded module list */}
        {expanded && (
          <div className="mt-3 space-y-1.5">
            {domain.modules.map(m => {
              const moduleOn = isModuleEnabled(m.id);
              const MIcon = m.icon;
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-150",
                    moduleOn ? `${colors.bg} ${colors.border}` : "bg-muted/10 border-border/20"
                  )}
                >
                  <MIcon className={cn("h-3.5 w-3.5 shrink-0", moduleOn ? colors.text : "text-muted-foreground/30")} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium leading-none", moduleOn ? "text-foreground" : "text-muted-foreground/40")}>
                      {m.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5 truncate">{m.helpText}</p>
                  </div>
                  {!isLocked && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Switch
                          checked={moduleOn}
                          onCheckedChange={v => onModuleToggle(m.id, v)}
                          className="shrink-0 scale-75 data-[state=checked]:bg-primary"
                          data-testid={`switch-module-${m.id}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">
                        {moduleOn ? "Disable" : "Enable"} {m.name}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* autoEnable notice */}
        {domain.autoEnableModules && domain.autoEnableModules.length > 0 && isDomainEnabled && (
          <p className="text-[10px] text-amber-400/70 mt-3 flex items-center gap-1.5">
            <Zap className="h-3 w-3 shrink-0" />
            Also activates: {domain.autoEnableModules
              .map(id => DOMAINS.flatMap(d => d.modules).find(m => m.id === id)?.name)
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ModuleCatalog() {
  const { isDomainEnabled, isDomainLocked, requiredBy, isEnabled, setDomain, setModule, enableAll, resetToMinimum, isSaving } = useModules();
  const totalModules = DOMAINS.flatMap(d => d.modules).length;
  const enabledCount = DOMAINS.flatMap(d => d.modules).filter(m => isEnabled(m.id)).length;
  const pct = Math.round((enabledCount / totalModules) * 100);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <div className="relative border-b border-border/40 bg-gradient-to-br from-background via-primary/[0.03] to-purple-500/[0.04] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.08)_0%,_transparent_65%)] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[300px] bg-gradient-to-bl from-purple-600/[0.07] to-transparent pointer-events-none rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

          {/* Top row: branding + module count */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-5 min-w-0">
              <div className="relative flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-purple-600 shadow-[0_0_32px_-4px_hsl(var(--primary)/0.4)] shrink-0">
                <img src={holocronLogo} alt="Holocron AI" className="h-6 w-6 sm:h-8 sm:w-8 object-contain" />
                <div className="absolute -bottom-1 -right-1 h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full bg-green-500 border-2 border-background shadow-[0_0_8px_hsl(142_71%_50%/0.6)]" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight gradient-text">HOLOCRON AI</h1>
                  <Badge className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 hidden sm:inline-flex">
                    Platform Catalog
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground/70 mt-0.5 leading-snug">
                  Activate modules for your crew — sidebar adapts instantly.
                </p>
              </div>
            </div>

            <div className="shrink-0 text-right">
              {isSaving && (
                <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground/60 mb-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                </div>
              )}
              <p className="text-2xl sm:text-3xl font-black text-foreground leading-none">{enabledCount}</p>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">of {totalModules} active</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/50 mb-1.5">
              <span>Platform Coverage</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 mt-5">
            <Button variant="outline" size="sm" onClick={enableAll} className="text-xs border-border/40 hover:border-primary/30 h-8" data-testid="button-enable-all">
              <Sparkles className="h-3 w-3 mr-1.5" /> Enable All
            </Button>
            <Button variant="outline" size="sm" onClick={resetToMinimum} className="text-xs border-border/40 hover:border-destructive/30 hover:text-destructive h-8" data-testid="button-reset-minimum">
              Core Only
            </Button>
            <div className="flex-1" />
            <Link href="/dashboard">
              <Button size="sm" className="text-xs gap-1.5 h-8" data-testid="button-go-to-platform">
                <LayoutGrid className="h-3 w-3" />
                <span className="hidden sm:inline">Go to Platform</span>
                <span className="sm:hidden">Platform</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Domain grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {DOMAINS.map(domain => (
            <DomainCard
              key={domain.id}
              domain={domain}
              isDomainEnabled={isDomainEnabled(domain.id)}
              isDomainLocked={isDomainLocked(domain.id)}
              requiredBy={requiredBy(domain.id)}
              isModuleEnabled={isEnabled}
              onDomainToggle={v => setDomain(domain.id, v)}
              onModuleToggle={(id, v) => setModule(id, v)}
            />
          ))}
        </div>

        <p className="text-center text-[11px] text-muted-foreground/30 mt-8 sm:mt-10">
          Changes are saved automatically. Your sidebar reflects your selections in real-time.
        </p>
      </div>
    </div>
  );
}
