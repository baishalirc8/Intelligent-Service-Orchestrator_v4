import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, ArrowLeft, Loader2, Globe, Zap, Shield, Brain, Network, Activity, Bot } from "lucide-react";
import { Link } from "wouter";
import holocronLogo from "@assets/Holocron_Logo_Icon_White_1772663128663.png";

function FloatingOrb({ className }: { className?: string }) {
  return <div className={`absolute rounded-full blur-3xl pointer-events-none ${className}`} />;
}

function GridPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
      <svg width="100%" height="100%">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}

function HexRing({ delay = 0, size = 200, x = 0, y = 0 }: { delay?: number; size?: number; x?: number; y?: number }) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        animation: `pulse-glow 4s ease-in-out ${delay}s infinite`,
      }}
    >
      <div
        className="w-full h-full rounded-full border border-primary/10"
        style={{ animation: `spin 20s linear infinite` }}
      />
    </div>
  );
}

function StatsBar() {
  const stats = [
    { label: "AI Agents", value: "256+", icon: Bot },
    { label: "Departments", value: "10", icon: Network },
    { label: "Uptime SLA", value: "99.9%", icon: Activity },
  ];
  return (
    <div className="flex items-center gap-6">
      {stats.map(s => (
        <div key={s.label} className="flex items-center gap-2">
          <s.icon className="h-3.5 w-3.5 text-primary/60" />
          <span className="text-xs text-muted-foreground/80">{s.value}</span>
          <span className="text-[10px] text-muted-foreground/40">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("");
  const { login, register, isAuthenticated } = useAuth();

  const { data: countries } = useQuery<{ code: string; name: string; region: string }[]>({
    queryKey: ["/api/countries"],
    staleTime: Infinity,
  });
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated) setLocation("/dashboard");
  }, [isAuthenticated, setLocation]);

  if (isAuthenticated) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (isLogin) {
        await login.mutateAsync({ username, password });
      } else {
        if (!displayName.trim()) {
          toast({ title: "Display name is required", variant: "destructive" });
          return;
        }
        await register.mutateAsync({ username, password, displayName, email: email || undefined, companyName: companyName || undefined, country: country || undefined });
      }
      setLocation("/dashboard");
    } catch (err: any) {
      const msg = err.message?.includes(":") ? err.message.split(":").slice(1).join(":").trim() : err.message;
      let parsed = msg;
      try { parsed = JSON.parse(msg).message; } catch {}
      toast({ title: isLogin ? "Login failed" : "Registration failed", description: parsed, variant: "destructive" });
    }
  }

  const isPending = login.isPending || register.isPending;

  const features = [
    { icon: Brain, label: "Autonomous AI Agents", desc: "Self-managing infrastructure experts" },
    { icon: Shield, label: "Enterprise Security", desc: "SOC 2, NIST, ISO 27001 aligned" },
    { icon: Zap, label: "Real-time Orchestration", desc: "Proactive event management" },
  ];

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      <GridPattern />

      <FloatingOrb className="w-[600px] h-[600px] bg-primary/[0.04] -top-48 -left-48" />
      <FloatingOrb className="w-[500px] h-[500px] bg-purple-500/[0.03] bottom-[-200px] right-[-100px]" />
      <FloatingOrb className="w-[300px] h-[300px] bg-cyan-500/[0.02] top-1/2 left-1/3" />

      <HexRing delay={0} size={300} x={5} y={15} />
      <HexRing delay={1.5} size={200} x={85} y={70} />
      <HexRing delay={3} size={150} x={15} y={75} />

      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 z-10">
        <div>
          <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2" asChild data-testid="button-back-landing">
            <Link href="/"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back to website</Link>
          </Button>
        </div>

        <div className="max-w-lg space-y-10">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/10 flex items-center justify-center border border-primary/10 shadow-[0_0_30px_-5px_hsl(var(--primary)/0.15)]">
                <img src={holocronLogo} alt="Holocron AI" className="h-9 w-9 object-contain" />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight gradient-text-bright">HOLOCRON AI</h1>
                <p className="text-sm text-muted-foreground/70 font-medium tracking-wide">Automation Orchestration Platform</p>
              </div>
            </div>
          </div>

          <p className="text-xl text-foreground/80 leading-relaxed font-light">
            Subscribe to AI-powered IT domain experts that work
            <span className="text-primary font-medium"> alongside your team</span>.
            Each agent brings deep specialization — available on demand.
          </p>

          <div className="space-y-3">
            {features.map((f, i) => (
              <div
                key={f.label}
                className="flex items-center gap-4 p-4 rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:bg-card/50 group"
              >
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-transparent flex items-center justify-center shrink-0 border border-primary/10 group-hover:border-primary/20 transition-colors">
                  <f.icon className="h-5 w-5 text-primary/70 group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground/90">{f.label}</h3>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
              </div>
            ))}
          </div>
        </div>

        <StatsBar />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6">
        <div className="lg:hidden flex items-center justify-between w-full max-w-md mb-8">
          <Button variant="ghost" size="sm" className="text-muted-foreground" asChild data-testid="button-back-landing-mobile">
            <Link href="/"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Link>
          </Button>
          <div className="flex items-center gap-2">
            <img src={holocronLogo} alt="Holocron AI" className="h-6 w-6 object-contain" />
            <span className="text-sm font-bold gradient-text-bright">HOLOCRON AI</span>
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-purple-500/10 to-primary/20 rounded-2xl blur-xl opacity-50" />

            <div className="relative rounded-2xl border border-border/40 bg-card/80 backdrop-blur-xl p-8 shadow-2xl">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute -inset-3 bg-primary/10 rounded-full blur-xl" />
                  <img src={holocronLogo} alt="Holocron AI" className="h-16 w-16 object-contain relative" data-testid="logo-auth" />
                </div>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold" data-testid="text-auth-title">{isLogin ? "Welcome back" : "Create your account"}</h2>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {isLogin ? "Sign in to your AI orchestration platform" : "Get started with HOLOCRON AI"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-xs font-medium text-muted-foreground">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    className="h-11 bg-background/50 border-border/40 focus:border-primary/40 transition-colors"
                    data-testid="input-username"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="h-11 bg-background/50 border-border/40 focus:border-primary/40 transition-colors"
                    data-testid="input-password"
                  />
                </div>

                {!isLogin && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="displayName" className="text-xs font-medium text-muted-foreground">Full Name</Label>
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your full name"
                        required
                        className="h-11 bg-background/50 border-border/40 focus:border-primary/40 transition-colors"
                        data-testid="input-display-name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="h-11 bg-background/50 border-border/40 focus:border-primary/40 transition-colors"
                        data-testid="input-email"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="companyName" className="text-xs font-medium text-muted-foreground">Company</Label>
                        <Input
                          id="companyName"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Your organization"
                          className="h-11 bg-background/50 border-border/40 focus:border-primary/40 transition-colors"
                          data-testid="input-company"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="country" className="text-xs font-medium text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            Country
                          </span>
                        </Label>
                        <Select value={country} onValueChange={setCountry}>
                          <SelectTrigger className="h-11 bg-background/50 border-border/40" data-testid="select-country">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[280px]">
                            {countries && (() => {
                              const grouped = new Map<string, typeof countries>();
                              countries.forEach(c => {
                                if (!grouped.has(c.region)) grouped.set(c.region, []);
                                grouped.get(c.region)!.push(c);
                              });
                              return Array.from(grouped.entries()).map(([region, items]) => (
                                <div key={region}>
                                  <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{region}</div>
                                  {items.map(c => (
                                    <SelectItem key={c.code} value={c.code} data-testid={`country-option-${c.code}`}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </div>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60">Pricing adjusts based on your country's salary market</p>
                  </>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-semibold relative overflow-hidden group"
                  disabled={isPending}
                  data-testid="button-submit-auth"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary via-purple-500 to-primary bg-[length:200%_100%] group-hover:animate-[shimmer_2s_linear_infinite] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative flex items-center justify-center gap-2">
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {isLogin ? "Sign In" : "Create Account"}
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </span>
                </Button>
              </form>

              <div className="mt-6 pt-5 border-t border-border/30">
                <p className="text-center text-sm text-muted-foreground">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button
                    onClick={() => { setIsLogin(!isLogin); setUsername(""); setPassword(""); setDisplayName(""); setEmail(""); setCompanyName(""); setCountry(""); }}
                    className="text-primary font-semibold hover:underline underline-offset-2"
                    data-testid="button-toggle-auth"
                  >
                    {isLogin ? "Sign up" : "Sign in"}
                  </button>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-[10px] text-muted-foreground/40">
              Protected by enterprise-grade encryption · SOC 2 Type II compliant
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
