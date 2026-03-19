import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Zap, Clock, Target, Flame, Star, Crown, Medal, Shield, Bot, TrendingUp, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentLeaderboardEntry {
  position: number;
  agentId: string;
  name: string;
  icon: string;
  color: string;
  incidentsResolved: number;
  srsResolved: number;
  totalResolved: number;
  avgResolutionMs: number;
  fastestResolutionMs: number;
  criticalResolved: number;
  streak: number;
  xp: number;
  level: number;
  rank: string;
}

interface LeaderboardData {
  leaderboard: AgentLeaderboardEntry[];
  summary: {
    totalResolved: number;
    globalAvgResolutionMs: number;
    fastestResolutionMs: number;
    totalAgents: number;
    totalXP: number;
    topRank: string;
  };
}

const RANK_CONFIG: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  Bronze: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", glow: "" },
  Silver: { color: "text-slate-300", bg: "bg-slate-400/10", border: "border-slate-400/30", glow: "" },
  Gold: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", glow: "shadow-yellow-500/20 shadow-lg" },
  Platinum: { color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30", glow: "shadow-cyan-500/20 shadow-lg" },
  Diamond: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", glow: "shadow-blue-500/25 shadow-xl" },
  Legendary: { color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", glow: "shadow-purple-500/30 shadow-xl" },
};

function formatDuration(ms: number): string {
  if (ms === 0) return "—";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return `${Math.round(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function RankIcon({ rank }: { rank: string }) {
  const cfg = RANK_CONFIG[rank] || RANK_CONFIG.Bronze;
  const icons: Record<string, typeof Trophy> = {
    Bronze: Shield,
    Silver: Medal,
    Gold: Award,
    Platinum: Star,
    Diamond: Crown,
    Legendary: Crown,
  };
  const Icon = icons[rank] || Shield;
  return <Icon className={cn("h-4 w-4", cfg.color)} />;
}

function XPBar({ xp, level }: { xp: number; level: number }) {
  const xpInLevel = xp % 500;
  const progress = (xpInLevel / 500) * 100;
  return (
    <div className="w-full" data-testid="xp-bar">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground font-medium">LVL {level}</span>
        <span className="text-[10px] text-violet-400 font-bold">{xp} XP</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function PositionBadge({ position }: { position: number }) {
  if (position === 1) return (
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 text-black font-black text-lg shadow-lg shadow-yellow-500/30" data-testid="badge-position-1">
      <Trophy className="h-5 w-5" />
    </div>
  );
  if (position === 2) return (
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-black font-black text-lg shadow-md" data-testid="badge-position-2">
      {position}
    </div>
  );
  if (position === 3) return (
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-700 text-black font-black text-lg shadow-md" data-testid="badge-position-3">
      {position}
    </div>
  );
  return (
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/30 text-muted-foreground font-bold text-sm" data-testid={`badge-position-${position}`}>
      #{position}
    </div>
  );
}

function PodiumCard({ entry, highlight }: { entry: AgentLeaderboardEntry; highlight: boolean }) {
  const rankCfg = RANK_CONFIG[entry.rank] || RANK_CONFIG.Bronze;
  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:scale-[1.02]",
      highlight && "ring-2 ring-yellow-500/50",
      rankCfg.glow
    )} data-testid={`card-podium-${entry.position}`}>
      {highlight && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />
      )}
      <CardContent className="pt-6 pb-4 px-4">
        <div className="flex flex-col items-center text-center gap-3">
          <PositionBadge position={entry.position} />
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl border-2" style={{ borderColor: entry.color, backgroundColor: `${entry.color}15` }}>
            <Bot className="h-7 w-7" style={{ color: entry.color }} />
          </div>
          <div>
            <h3 className="font-bold text-sm" data-testid={`text-name-${entry.agentId}`}>{entry.name}</h3>
            <div className="flex items-center justify-center gap-1 mt-1">
              <RankIcon rank={entry.rank} />
              <span className={cn("text-xs font-semibold", rankCfg.color)}>{entry.rank}</span>
            </div>
          </div>
          <XPBar xp={entry.xp} level={entry.level} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] mt-1 w-full">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Target className="h-3 w-3 text-emerald-400" />
              <span>{entry.totalResolved} resolved</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3 text-blue-400" />
              <span>{formatDuration(entry.avgResolutionMs)} avg</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Zap className="h-3 w-3 text-yellow-400" />
              <span>{formatDuration(entry.fastestResolutionMs)} best</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Flame className="h-3 w-3 text-orange-400" />
              <span>{entry.streak} streak</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LeaderboardRow({ entry }: { entry: AgentLeaderboardEntry }) {
  const rankCfg = RANK_CONFIG[entry.rank] || RANK_CONFIG.Bronze;
  return (
    <div className="flex items-center gap-4 py-3 px-4 rounded-lg hover:bg-muted/20 transition-colors group" data-testid={`row-agent-${entry.agentId}`}>
      <PositionBadge position={entry.position} />
      <div className="flex items-center justify-center w-10 h-10 rounded-xl border" style={{ borderColor: entry.color, backgroundColor: `${entry.color}10` }}>
        <Bot className="h-5 w-5" style={{ color: entry.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm truncate">{entry.name}</h4>
          <Badge variant="outline" className={cn("text-[10px] gap-1 px-1.5 py-0", rankCfg.border, rankCfg.color)}>
            <RankIcon rank={entry.rank} />
            {entry.rank}
          </Badge>
          {entry.streak >= 3 && (
            <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 border-orange-500/30 text-orange-400">
              <Flame className="h-3 w-3" /> {entry.streak}
            </Badge>
          )}
        </div>
        <div className="mt-1.5 max-w-[200px]">
          <XPBar xp={entry.xp} level={entry.level} />
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-6 text-xs text-muted-foreground">
        <div className="text-center min-w-[60px]">
          <p className="font-bold text-foreground text-sm">{entry.totalResolved}</p>
          <p className="text-[10px]">Resolved</p>
        </div>
        <div className="text-center min-w-[60px]">
          <p className="font-bold text-foreground text-sm">{formatDuration(entry.avgResolutionMs)}</p>
          <p className="text-[10px]">Avg Time</p>
        </div>
        <div className="text-center min-w-[60px]">
          <p className="font-bold text-foreground text-sm">{formatDuration(entry.fastestResolutionMs)}</p>
          <p className="text-[10px]">Fastest</p>
        </div>
        <div className="text-center min-w-[60px]">
          <p className="font-bold text-foreground text-sm">{entry.criticalResolved}</p>
          <p className="text-[10px]">Critical</p>
        </div>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { data, isLoading } = useQuery<LeaderboardData>({
    queryKey: ["/api/leaderboard"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const lb = data?.leaderboard || [];
  const summary = data?.summary;
  const podium = lb.slice(0, 3);
  const rest = lb.slice(3);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto" data-testid="page-leaderboard">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card data-testid="card-total-resolved">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10">
                <Target className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-black">{summary?.totalResolved || 0}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-avg-resolution">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-black">{formatDuration(summary?.globalAvgResolutionMs || 0)}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Avg Resolution</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-fastest">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-yellow-500/10">
                <Zap className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-black">{formatDuration(summary?.fastestResolutionMs || 0)}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Fastest Resolution</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-xp">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10">
                <TrendingUp className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-black">{(summary?.totalXP || 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total XP Earned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {podium.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-5 w-5 text-yellow-400" />
            <h2 className="text-lg font-bold">Top Performers</h2>
          </div>
          <div className={cn(
            "grid gap-4",
            podium.length === 1 && "grid-cols-1 max-w-sm mx-auto",
            podium.length === 2 && "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto",
            podium.length >= 3 && "grid-cols-1 sm:grid-cols-3",
          )}>
            {podium.map(entry => (
              <PodiumCard key={entry.agentId} entry={entry} highlight={entry.position === 1} />
            ))}
          </div>
        </div>
      )}

      <Card data-testid="card-full-rankings">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-5 w-5 text-violet-400" />
            Full Rankings
            <Badge variant="secondary" className="ml-auto text-xs">{lb.length} agents</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          {lb.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Trophy className="h-12 w-12 mb-4 text-muted-foreground/30" />
              <p className="text-lg font-medium">No rankings yet</p>
              <p className="text-sm mt-1">Resolve incidents and service requests to start earning XP</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {lb.map(entry => (
                <LeaderboardRow key={entry.agentId} entry={entry} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-400" />
            How XP is Earned
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Incident Resolved", xp: 100, icon: Shield, color: "text-red-400" },
              { label: "Service Request", xp: 50, icon: Target, color: "text-emerald-400" },
              { label: "Critical Incident", xp: 200, icon: Flame, color: "text-orange-400" },
              { label: "Speed Bonus (<2h)", xp: 75, icon: Zap, color: "text-yellow-400" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/10 border border-border/50">
                <item.icon className={cn("h-5 w-5 shrink-0", item.color)} />
                <div>
                  <p className="text-xs font-medium">{item.label}</p>
                  <p className="text-sm font-bold text-violet-400">+{item.xp} XP</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
