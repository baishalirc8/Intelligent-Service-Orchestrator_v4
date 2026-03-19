import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Crosshair, AlertTriangle, Radio, Search, RefreshCw, ExternalLink,
  TrendingUp, Shield, Eye, Zap, Globe, Bug, Activity, ChevronRight,
  Brain, Sparkles, Copy, CheckCheck, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { SuggestedAgentsPanel } from "@/components/security/suggested-agents";

const SEVERITY_COLORS: Record<string, string> = {
  Critical: "bg-red-500/20 text-red-300 border-red-500/30",
  High:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Medium:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Low:      "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Info:     "bg-muted/20 text-muted-foreground border-border/30",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  High:   "text-green-400",
  Medium: "text-yellow-400",
  Low:    "text-red-400",
};

const THREAT_FEEDS = [
  { id: "TF-001", name: "AlienVault OTX",        type: "Commercial",   status: "Live",   iocs: 14320, updated: "2 min ago",  category: "Multi-type" },
  { id: "TF-002", name: "CISA KEV Catalog",       type: "Government",   status: "Live",   iocs: 1082,  updated: "6 min ago",  category: "CVE/Exploit" },
  { id: "TF-003", name: "Mandiant Threat Intel",  type: "Commercial",   status: "Live",   iocs: 8740,  updated: "12 min ago", category: "APT Actors" },
  { id: "TF-004", name: "MISP Community",         type: "Open Source",  status: "Live",   iocs: 54200, updated: "18 min ago", category: "Multi-type" },
  { id: "TF-005", name: "Abuse.ch URLhaus",       type: "Open Source",  status: "Live",   iocs: 31000, updated: "4 min ago",  category: "URL/Domain" },
  { id: "TF-006", name: "Emerging Threats Pro",   type: "Commercial",   status: "Live",   iocs: 22100, updated: "8 min ago",  category: "Network" },
  { id: "TF-007", name: "CrowdStrike Intel",      type: "Commercial",   status: "Stale",  iocs: 9800,  updated: "3 hrs ago",  category: "APT Actors" },
  { id: "TF-008", name: "CIRCL OSINT Feed",       type: "Open Source",  status: "Live",   iocs: 6540,  updated: "32 min ago", category: "Multi-type" },
];

const IOCS = [
  { id: "IOC-001", type: "IP",     value: "192.168.45[.]221",      source: "Mandiant",    confidence: "High",   tlp: "RED",   tags: ["Cobalt Strike","C2"],      severity: "Critical", firstSeen: "2025-03-14" },
  { id: "IOC-002", type: "Domain", value: "update-cdn[.]tech",     source: "AlienVault",  confidence: "High",   tlp: "AMBER", tags: ["Phishing","APT29"],       severity: "Critical", firstSeen: "2025-03-15" },
  { id: "IOC-003", type: "Hash",   value: "a3f2b1...e94d",         source: "CISA KEV",    confidence: "High",   tlp: "WHITE", tags: ["Ransomware","LockBit"],   severity: "Critical", firstSeen: "2025-03-13" },
  { id: "IOC-004", type: "URL",    value: "hxxps://cdn[.]evil/p",  source: "URLhaus",     confidence: "Medium", tlp: "GREEN", tags: ["Malware Drop","Loader"],  severity: "High",     firstSeen: "2025-03-12" },
  { id: "IOC-005", type: "IP",     value: "10.44.89[.]17",         source: "Emerging",    confidence: "Medium", tlp: "AMBER", tags: ["Scan","Bruteforce"],     severity: "High",     firstSeen: "2025-03-11" },
  { id: "IOC-006", type: "Domain", value: "secure-login[.]biz",   source: "MISP",        confidence: "High",   tlp: "AMBER", tags: ["Credential Theft"],      severity: "High",     firstSeen: "2025-03-10" },
  { id: "IOC-007", type: "Hash",   value: "7c9de3...1a22",         source: "CrowdStrike", confidence: "High",   tlp: "RED",   tags: ["APT28","Backdoor"],      severity: "Critical", firstSeen: "2025-03-09" },
  { id: "IOC-008", type: "IP",     value: "185.220[.]101.45",      source: "AlienVault",  confidence: "Low",    tlp: "GREEN", tags: ["TOR Exit"],              severity: "Medium",   firstSeen: "2025-03-08" },
];

const THREAT_ACTORS = [
  { name: "APT29 (Cozy Bear)",   nation: "Russia",      ttps: ["Phishing","Supply Chain","T1566","T1195"], active: true,  severity: "Critical", sector: "Government, Defence" },
  { name: "APT28 (Fancy Bear)",  nation: "Russia",      ttps: ["Credential","Exploit","T1078","T1190"],    active: true,  severity: "Critical", sector: "Energy, Media" },
  { name: "Lazarus Group",       nation: "N. Korea",    ttps: ["Ransomware","Crypto","T1486","T1041"],     active: true,  severity: "Critical", sector: "Finance, Tech" },
  { name: "LockBit 3.0",         nation: "Cybercrime",  ttps: ["RaaS","Exfil","T1486","T1041"],            active: true,  severity: "Critical", sector: "All verticals" },
  { name: "Cl0p",                nation: "Cybercrime",  ttps: ["Zero-day","MFT","T1190","T1505"],          active: false, severity: "High",     sector: "Healthcare, Finance" },
  { name: "BlackCat (ALPHV)",    nation: "Cybercrime",  ttps: ["RaaS","Living off Land","T1078"],          active: true,  severity: "Critical", sector: "Healthcare, Critical Infra" },
];

const MITRE_TACTICS = [
  { name: "Reconnaissance",      id: "TA0043", covered: 4,  total: 10 },
  { name: "Resource Dev.",        id: "TA0042", covered: 3,  total: 7 },
  { name: "Initial Access",       id: "TA0001", covered: 8,  total: 9 },
  { name: "Execution",            id: "TA0002", covered: 7,  total: 14 },
  { name: "Persistence",          id: "TA0003", covered: 6,  total: 19 },
  { name: "Priv. Escalation",    id: "TA0004", covered: 5,  total: 13 },
  { name: "Defense Evasion",      id: "TA0005", covered: 9,  total: 42 },
  { name: "Credential Access",    id: "TA0006", covered: 7,  total: 17 },
  { name: "Discovery",            id: "TA0007", covered: 10, total: 31 },
  { name: "Lateral Movement",     id: "TA0008", covered: 5,  total: 9 },
  { name: "Collection",           id: "TA0009", covered: 4,  total: 17 },
  { name: "C2",                   id: "TA0011", covered: 11, total: 16 },
  { name: "Exfiltration",         id: "TA0010", covered: 5,  total: 9 },
  { name: "Impact",               id: "TA0040", covered: 8,  total: 13 },
];

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground/80">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="text-sm font-bold text-foreground mt-3">{line.slice(3)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="text-xs font-bold text-foreground/90 mt-2">{line.slice(4)}</p>;
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-foreground/90">{line.slice(2, -2)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) {
          const content = line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1");
          return <p key={i} className="pl-3 border-l border-violet-500/30 text-muted-foreground/70">{content}</p>;
        }
        const rendered = line.replace(/\*\*(.*?)\*\*/g, "$1");
        if (!rendered.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{rendered}</p>;
      })}
    </div>
  );
}

function AiThreatBriefing() {
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/security/ai/threat-briefing", {
        iocs: IOCS,
        actors: THREAT_ACTORS,
        feeds: THREAT_FEEDS,
      });
      return r.json();
    },
  });

  const briefing = (mutation.data as any)?.briefing as string | undefined;

  const handleCopy = () => {
    if (briefing) {
      navigator.clipboard.writeText(briefing);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-violet-950/40 to-card/60 border-violet-500/25">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-400" />
            AI Threat Intelligence Briefing
            <Badge className="text-[10px] bg-violet-500/15 text-violet-400 border-violet-500/20">
              <Sparkles className="h-2.5 w-2.5 mr-1" />Generative AI
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {briefing && (
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5 text-muted-foreground" onClick={handleCopy} data-testid="button-copy-briefing">
                {copied ? <CheckCheck className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            )}
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              data-testid="button-generate-briefing"
            >
              {mutation.isPending
                ? <><Loader2 className="h-3 w-3 animate-spin" />Analyzing...</>
                : briefing
                  ? <><RefreshCw className="h-3 w-3" />Regenerate</>
                  : <><Zap className="h-3 w-3" />Generate Briefing</>
              }
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mutation.isPending && (
          <div className="flex items-center gap-3 py-6 justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            <p className="text-xs text-muted-foreground/60">AI is analyzing {IOCS.length} IOCs, {THREAT_ACTORS.filter(a => a.active).length} active threat actors, and {THREAT_FEEDS.filter(f => f.status === "Live").length} live feeds…</p>
          </div>
        )}
        {mutation.isError && (
          <p className="text-xs text-red-400 py-4 text-center">Failed to generate briefing. Please check your AI provider configuration.</p>
        )}
        {!mutation.isPending && !briefing && !mutation.isError && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Brain className="h-8 w-8 text-violet-400/40" />
            <div>
              <p className="text-sm font-medium text-foreground/60">Daily Threat Intelligence Briefing</p>
              <p className="text-xs text-muted-foreground/40 mt-1">Click Generate to produce an AI-powered analysis of current threat feeds, IOCs, and active threat actors.</p>
            </div>
          </div>
        )}
        {briefing && <MarkdownText text={briefing} />}
      </CardContent>
    </Card>
  );
}

export default function ThreatIntelligence() {
  const [iocFilter, setIocFilter] = useState<string>("all");
  const [iocSearch, setIocSearch] = useState("");

  const totalIocs = IOCS.length;
  const criticalIocs = IOCS.filter(i => i.severity === "Critical").length;
  const activeActors = THREAT_ACTORS.filter(a => a.active).length;
  const feedsLive = THREAT_FEEDS.filter(f => f.status === "Live").length;

  const filteredIocs = IOCS.filter(i => {
    const matchType = iocFilter === "all" || i.type.toLowerCase() === iocFilter;
    const matchSearch = !iocSearch || i.value.toLowerCase().includes(iocSearch.toLowerCase()) || i.tags.some(t => t.toLowerCase().includes(iocSearch.toLowerCase()));
    return matchType && matchSearch;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <SuggestedAgentsPanel module="threat-intelligence" />

      {/* AI Briefing — top of page, proactive */}
      <AiThreatBriefing />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active IOCs", value: "131,782", icon: Crosshair, color: "text-red-400", sub: `${criticalIocs} critical` },
          { label: "New Today",   value: "2,340",   icon: TrendingUp, color: "text-orange-400", sub: "↑ 12% vs yesterday" },
          { label: "Threat Actors", value: activeActors.toString(), icon: Bug, color: "text-violet-400", sub: "actively tracked" },
          { label: "Feeds Online", value: `${feedsLive}/${THREAT_FEEDS.length}`, icon: Radio, color: "text-green-400", sub: "all healthy" },
        ].map(s => (
          <Card key={s.label} className="bg-card/60 border-border/40">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground/60">{s.label}</p>
                  <p className={cn("text-2xl font-black mt-1", s.color)}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">{s.sub}</p>
                </div>
                <s.icon className={cn("h-5 w-5 mt-0.5", s.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Threat Feeds */}
        <Card className="bg-card/60 border-border/40 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Radio className="h-4 w-4 text-green-400" />
              Intelligence Feeds
              <Badge className="ml-auto text-[10px] bg-green-500/10 text-green-400 border-green-500/20">
                {feedsLive} Live
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {THREAT_FEEDS.map(f => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/10 transition-colors">
                  <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", f.status === "Live" ? "bg-green-400 shadow-[0_0_4px_hsl(142_71%_50%/0.6)]" : "bg-yellow-400")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{f.name}</p>
                    <p className="text-[10px] text-muted-foreground/40">{f.category} · {f.iocs.toLocaleString()} IOCs</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className={cn("text-[9px] px-1.5 py-0 border-0", f.type === "Government" ? "bg-blue-500/15 text-blue-400" : f.type === "Commercial" ? "bg-violet-500/15 text-violet-400" : "bg-muted/20 text-muted-foreground/60")}>
                      {f.type}
                    </Badge>
                    <p className="text-[9px] text-muted-foreground/30 mt-0.5">{f.updated}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* IOC Table */}
        <Card className="bg-card/60 border-border/40 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Eye className="h-4 w-4 text-red-400" />
                Indicators of Compromise
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40" />
                  <Input
                    placeholder="Search IOCs..."
                    value={iocSearch}
                    onChange={e => setIocSearch(e.target.value)}
                    className="pl-7 h-7 text-xs w-40 bg-muted/20"
                    data-testid="input-ioc-search"
                  />
                </div>
                <Select value={iocFilter} onValueChange={setIocFilter}>
                  <SelectTrigger className="h-7 text-xs w-24 bg-muted/20" data-testid="select-ioc-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="ip">IP</SelectItem>
                    <SelectItem value="domain">Domain</SelectItem>
                    <SelectItem value="hash">Hash</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30">
                    {["Type","Indicator","Source","Confidence","TLP","Severity","Tags"].map(h => (
                      <th key={h} className="text-left text-[10px] text-muted-foreground/50 font-medium px-4 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filteredIocs.map(ioc => (
                    <tr key={ioc.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-2.5">
                        <Badge className="text-[9px] px-1.5 py-0 border-0 bg-muted/20 text-muted-foreground">{ioc.type}</Badge>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-foreground/80 max-w-[140px] truncate">{ioc.value}</td>
                      <td className="px-4 py-2.5 text-muted-foreground/60">{ioc.source}</td>
                      <td className={cn("px-4 py-2.5 font-medium", CONFIDENCE_COLORS[ioc.confidence] || "text-muted-foreground")}>{ioc.confidence}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={cn("text-[9px] px-1.5 py-0 border-0 font-bold",
                          ioc.tlp === "RED" ? "bg-red-500/20 text-red-400" :
                          ioc.tlp === "AMBER" ? "bg-amber-500/20 text-amber-400" :
                          ioc.tlp === "GREEN" ? "bg-green-500/20 text-green-400" :
                          "bg-muted/20 text-muted-foreground"
                        )}>TLP:{ioc.tlp}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={cn("text-[9px] px-1.5 py-0 border", SEVERITY_COLORS[ioc.severity])}>
                          {ioc.severity}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {ioc.tags.slice(0,2).map(t => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/20 text-muted-foreground/50">{t}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Threat Actors */}
        <Card className="bg-card/60 border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Bug className="h-4 w-4 text-violet-400" />
              Tracked Threat Actors
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {THREAT_ACTORS.map(a => (
                <div key={a.name} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/10 transition-colors">
                  <div className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0", a.active ? "bg-red-400 shadow-[0_0_4px_hsl(0_84%_60%/0.5)]" : "bg-muted-foreground/30")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold">{a.name}</p>
                      <Badge className={cn("text-[9px] px-1.5 py-0 border", SEVERITY_COLORS[a.severity])}>{a.severity}</Badge>
                      {a.active && <Badge className="text-[9px] px-1.5 py-0 border-0 bg-red-500/15 text-red-400">ACTIVE</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{a.nation} · Targets: {a.sector}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {a.ttps.map(t => (
                        <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400/70">{t}</span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 mt-1 shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* MITRE ATT&CK Coverage */}
        <Card className="bg-card/60 border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400" />
              MITRE ATT&amp;CK Coverage
              <Badge className="ml-auto text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                {Math.round(MITRE_TACTICS.reduce((a,t) => a + t.covered, 0) / MITRE_TACTICS.reduce((a,t) => a + t.total, 0) * 100)}% avg
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {MITRE_TACTICS.map(t => {
              const pct = Math.round((t.covered / t.total) * 100);
              return (
                <div key={t.id}>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground/70 font-medium">{t.name}</span>
                    <span className="text-muted-foreground/40">{t.covered}/{t.total} — {pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
