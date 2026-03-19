import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import {
  Gauge, Users, Bot, MessageSquare, Lightbulb,
  ChevronRight, ChevronLeft, X, Sparkles, Rocket,
} from "lucide-react";

interface TourStep {
  title: string;
  description: string;
  icon: any;
  targetSelector?: string;
  route?: string;
  position: "center" | "right" | "bottom";
  color: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to HOLOCRON AI",
    description: "Let's take a quick tour of your AI-powered IT orchestration platform. This will only take a minute.",
    icon: Rocket,
    position: "center",
    color: "#8b5cf6",
  },
  {
    title: "Crews & Agents",
    description: "This is your command center. Departments are organized as 'Crews' and roles as 'Agents'. Subscribe AI agents to roles to automate your IT operations.",
    icon: Users,
    targetSelector: '[data-testid="sidebar-crews-agents"]',
    route: "/dashboard",
    position: "right",
    color: "#3b82f6",
  },
  {
    title: "Infrastructure Cockpit",
    description: "Your real-time operational dashboard. Monitor asset health, alerts, probes, AI agent activity, and scheduled maintenance — all in one place.",
    icon: Gauge,
    targetSelector: '[data-testid="sidebar-cockpit"]',
    route: "/infrastructure/cockpit",
    position: "right",
    color: "#10b981",
  },
  {
    title: "AI Agent Matrix",
    description: "See all your AI agents at a glance — their departments, assigned metrics, and performance. Click any agent to dive into their individual dashboard.",
    icon: Bot,
    targetSelector: '[data-testid="sidebar-agent-matrix"]',
    route: "/agent-matrix",
    position: "right",
    color: "#8b5cf6",
  },
  {
    title: "Agent Chat",
    description: "Have natural conversations with your AI agents. Ask questions about your infrastructure, request analyses, or get recommendations in plain language.",
    icon: MessageSquare,
    targetSelector: '[data-testid="sidebar-agent-chat"]',
    route: "/agent-chat",
    position: "right",
    color: "#f59e0b",
  },
  {
    title: "AI Recommendations",
    description: "Your AI agents continuously analyze your infrastructure and generate actionable insights — from cost savings to security improvements.",
    icon: Lightbulb,
    targetSelector: '[data-testid="sidebar-recommendations"]',
    route: "/recommendations",
    position: "right",
    color: "#ef4444",
  },
  {
    title: "You're All Set!",
    description: "Use Cmd+K (or Ctrl+K) anytime to quickly search and navigate. Check the setup progress indicator in the header to see what's left to configure. Let's get started!",
    icon: Sparkles,
    position: "center",
    color: "#8b5cf6",
  },
];

export function GuidedTour({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [, setLocation] = useLocation();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const currentStep = TOUR_STEPS[step];

  const findTarget = useCallback(() => {
    if (!currentStep.targetSelector) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [currentStep.targetSelector]);

  useEffect(() => {
    findTarget();
    const timer = setTimeout(findTarget, 300);
    window.addEventListener("resize", findTarget);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", findTarget);
    };
  }, [step, findTarget]);

  useEffect(() => {
    if (currentStep.route) {
      setLocation(currentStep.route);
    }
  }, [step]);

  const handleNext = () => {
    if (step < TOUR_STEPS.length - 1) {
      setIsAnimating(true);
      setTimeout(() => {
        setStep(step + 1);
        setIsAnimating(false);
      }, 150);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setIsAnimating(true);
      setTimeout(() => {
        setStep(step - 1);
        setIsAnimating(false);
      }, 150);
    }
  };

  const handleComplete = async () => {
    try {
      await apiRequest("POST", "/api/auth/complete-tour");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (e) {}
    onComplete();
  };

  const Icon = currentStep.icon;
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;

  const tooltipHeight = 200;
  const tooltipWidth = 360;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1280;

  const tooltipStyle: React.CSSProperties = {};
  if (currentStep.position === "center") {
    tooltipStyle.top = "50%";
    tooltipStyle.left = "50%";
    tooltipStyle.transform = "translate(-50%, -50%)";
  } else if (currentStep.position === "right" && targetRect) {
    const idealTop = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
    const clampedTop = Math.max(16, Math.min(idealTop, viewportH - tooltipHeight - 16));
    tooltipStyle.top = `${clampedTop}px`;
    const fitsRight = targetRect.right + 16 + tooltipWidth < viewportW - 16;
    tooltipStyle.left = fitsRight
      ? `${targetRect.right + 16}px`
      : `${Math.max(16, targetRect.left - tooltipWidth - 16)}px`;
  } else if (currentStep.position === "bottom" && targetRect) {
    tooltipStyle.top = `${Math.min(targetRect.bottom + 12, viewportH - tooltipHeight - 16)}px`;
    tooltipStyle.left = `${Math.min(targetRect.left, viewportW - tooltipWidth - 16)}px`;
  } else {
    tooltipStyle.top = "50%";
    tooltipStyle.left = "50%";
    tooltipStyle.transform = "translate(-50%, -50%)";
  }

  return (
    <div className="fixed inset-0 z-[9999]" data-testid="guided-tour-overlay">
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 4}
                y={targetRect.top - 4}
                width={targetRect.width + 8}
                height={targetRect.height + 8}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#tour-mask)"
          style={{ pointerEvents: "auto" }}
          onClick={(e) => e.stopPropagation()}
        />
      </svg>

      {targetRect && (
        <div
          className="absolute rounded-lg border-2 pointer-events-none"
          style={{
            left: targetRect.left - 4,
            top: targetRect.top - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            borderColor: currentStep.color,
            boxShadow: `0 0 0 4px ${currentStep.color}30, 0 0 20px ${currentStep.color}20`,
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
      )}

      <div
        className={`absolute z-[10000] w-[360px] max-w-[90vw] transition-opacity duration-150 ${isAnimating ? "opacity-0" : "opacity-100"}`}
        style={tooltipStyle}
        data-testid="tour-tooltip"
      >
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${currentStep.color}, ${currentStep.color}60, transparent)` }} />

          <div className="p-5">
            <div className="flex items-start gap-3 mb-3">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${currentStep.color}15` }}
              >
                <Icon className="h-5 w-5" style={{ color: currentStep.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold mb-0.5">{currentStep.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{currentStep.description}</p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-1">
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: i === step ? 20 : 6,
                      backgroundColor: i === step ? currentStep.color : i < step ? `${currentStep.color}60` : "hsl(var(--muted))",
                    }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                {!isFirst && !isLast && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={handlePrev}
                    data-testid="tour-prev"
                  >
                    <ChevronLeft className="h-3 w-3 mr-0.5" />
                    Back
                  </Button>
                )}
                {!isLast && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-muted-foreground"
                    onClick={handleComplete}
                    data-testid="tour-skip"
                  >
                    Skip
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-7 px-3 text-[11px]"
                  style={{ backgroundColor: currentStep.color }}
                  onClick={handleNext}
                  data-testid="tour-next"
                >
                  {isFirst ? "Start Tour" : isLast ? "Get Started" : "Next"}
                  {!isLast && <ChevronRight className="h-3 w-3 ml-0.5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
