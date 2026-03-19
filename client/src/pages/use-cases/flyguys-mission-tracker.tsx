import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Navigation, AlertTriangle, CheckCircle2, Activity, Plane,
  MapPin, Trash2, Play, Square, RefreshCw, ArrowLeft,
  Zap, Shield, Clock, Info
} from "lucide-react";
import type { FlyguysProject } from "@shared/schema";

// Fix Leaflet default icon paths in Vite
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

// ── Types ─────────────────────────────────────────────────────────────────────
interface Waypoint { lat: number; lng: number; label: string; order: number; }
interface RouteAnalysis {
  status: "on-track" | "minor-deviation" | "major-deviation" | "off-route";
  adherenceScore: number;
  summary: string;
  alerts: string[];
  recommendation: string;
  distanceKm: number | null;
}

// ── Custom map icons ──────────────────────────────────────────────────────────
const droneIcon = L.divIcon({
  html: `<div style="width:36px;height:36px;background:#6366f1;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:18px;">✈</div>`,
  className: "",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const waypointIcon = (index: number, isVisited: boolean) => L.divIcon({
  html: `<div style="width:28px;height:28px;background:${isVisited ? "#10b981" : "#6366f1"};border-radius:50%;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;">${index + 1}</div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const startIcon = L.divIcon({
  html: `<div style="width:28px;height:28px;background:#10b981;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;">S</div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// ── Map click handler component ───────────────────────────────────────────────
function MapClickHandler({ onMapClick, planningMode }: { onMapClick: (lat: number, lng: number) => void; planningMode: boolean }) {
  useMapEvents({
    click(e) {
      if (planningMode) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── Recenter map when drone moves ─────────────────────────────────────────────
function MapRecenter({ lat, lng, follow }: { lat: number; lng: number; follow: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (follow && lat && lng) map.panTo([lat, lng], { animate: true, duration: 0.8 });
  }, [lat, lng, follow, map]);
  return null;
}

// ── Status helpers ────────────────────────────────────────────────────────────
function AdherenceStatus({ status }: { status: RouteAnalysis["status"] | null }) {
  if (!status) return <Badge variant="outline" className="text-xs">No Data</Badge>;
  const map = {
    "on-track": { cls: "bg-green-100 text-green-700 border-green-200", label: "On Track", icon: <CheckCircle2 className="w-3 h-3" /> },
    "minor-deviation": { cls: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "Minor Deviation", icon: <Info className="w-3 h-3" /> },
    "major-deviation": { cls: "bg-orange-100 text-orange-700 border-orange-200", label: "Major Deviation", icon: <AlertTriangle className="w-3 h-3" /> },
    "off-route": { cls: "bg-red-100 text-red-700 border-red-200", label: "Off Route!", icon: <AlertTriangle className="w-3 h-3" /> },
  };
  const s = map[status];
  return <Badge className={`${s.cls} flex items-center gap-1 border text-xs`}>{s.icon}{s.label}</Badge>;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FlyguaysMissionTracker() {
  const { id: projectId } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Map state
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [dronePos, setDronePos] = useState<{ lat: number; lng: number } | null>(null);
  const [planningMode, setPlanningMode] = useState(false);
  const [followDrone, setFollowDrone] = useState(true);
  const [labelInput, setLabelInput] = useState("");

  // Simulation state
  const [simRunning, setSimRunning] = useState(false);
  const [simWpIndex, setSimWpIndex] = useState(0);
  const [visitedWps, setVisitedWps] = useState<Set<number>>(new Set());
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // AI analysis state
  const [analysis, setAnalysis] = useState<RouteAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [allAlerts, setAllAlerts] = useState<Array<{ text: string; time: string; level: string }>>([]);

  // Load project
  const { data: project, isLoading } = useQuery<FlyguysProject>({
    queryKey: ["/api/flyguys/projects", projectId],
    queryFn: async () => {
      const r = await fetch(`/api/flyguys/projects/${projectId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Project not found");
      return r.json();
    },
    enabled: !!projectId,
  });

  // Initialize from project data
  useEffect(() => {
    if (!project) return;
    if (project.waypointsJson) {
      try { setWaypoints(JSON.parse(project.waypointsJson)); } catch {}
    }
    if (project.currentLat && project.currentLng) {
      setDronePos({ lat: project.currentLat, lng: project.currentLng });
    }
    if (project.routeAlerts?.length) {
      setAllAlerts((project.routeAlerts as string[]).map((a, i) => ({
        text: a, time: "Stored", level: "warning"
      })));
    }
  }, [project]);

  // Save waypoints mutation
  const saveWaypointsMut = useMutation({
    mutationFn: async (wps: Waypoint[]) => {
      const r = await apiRequest("PATCH", `/api/flyguys/projects/${projectId}/waypoints`, { waypoints: wps });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flyguys/projects", projectId] });
      toast({ title: "Itinerary saved" });
    },
  });

  // Update position mutation
  const updatePosMut = useMutation({
    mutationFn: async (pos: { lat: number; lng: number; heading?: number }) => {
      const r = await apiRequest("PATCH", `/api/flyguys/projects/${projectId}/position`, pos);
      return r.json();
    },
  });

  // Clear alerts mutation
  const clearAlertsMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("DELETE", `/api/flyguys/projects/${projectId}/route-alerts`);
      return r.json();
    },
    onSuccess: () => {
      setAllAlerts([]);
      queryClient.invalidateQueries({ queryKey: ["/api/flyguys/projects", projectId] });
    },
  });

  // AI route check
  const checkRoute = useCallback(async (lat: number, lng: number, wpIndex: number) => {
    if (!project?.waypointsJson || waypoints.length === 0) return;
    setAnalyzing(true);
    try {
      const r = await apiRequest("POST", `/api/flyguys/projects/${projectId}/route-check`, {
        currentLat: lat, currentLng: lng,
        waypointsJson: JSON.stringify(waypoints),
        expectedWaypointIndex: wpIndex,
      });
      const data: RouteAnalysis = await r.json();
      setAnalysis(data);
      if (data.alerts?.length > 0) {
        const now = new Date().toLocaleTimeString();
        const level = data.status === "off-route" ? "critical" : data.status === "major-deviation" ? "warning" : "info";
        setAllAlerts(prev => [
          ...data.alerts.map(a => ({ text: a, time: now, level })),
          ...prev,
        ].slice(0, 50));
      }
    } catch {}
    setAnalyzing(false);
  }, [projectId, waypoints, project?.waypointsJson]);

  // Map click to add waypoint in planning mode
  const handleMapClick = useCallback((lat: number, lng: number) => {
    const label = labelInput.trim() || `WP ${waypoints.length + 1}`;
    const newWp: Waypoint = { lat, lng, label, order: waypoints.length };
    setWaypoints(prev => [...prev, newWp]);
    setLabelInput("");
  }, [waypoints.length, labelInput]);

  // Start simulation
  const startSimulation = useCallback(() => {
    if (waypoints.length < 2) {
      toast({ title: "Need at least 2 waypoints", variant: "destructive" }); return;
    }
    setSimRunning(true);
    setSimWpIndex(0);
    setVisitedWps(new Set());
    setDronePos({ lat: waypoints[0].lat, lng: waypoints[0].lng });
    let currentWpIdx = 0;
    let stepFraction = 0;

    simRef.current = setInterval(async () => {
      if (currentWpIdx >= waypoints.length - 1) {
        clearInterval(simRef.current!);
        setSimRunning(false);
        setVisitedWps(new Set(waypoints.map((_, i) => i)));
        toast({ title: "Flight simulation complete!", description: "Drone has reached the final waypoint." });
        return;
      }

      const from = waypoints[currentWpIdx];
      const to = waypoints[currentWpIdx + 1];
      stepFraction += 0.15;

      if (stepFraction >= 1) {
        stepFraction = 0;
        currentWpIdx++;
        setSimWpIndex(currentWpIdx);
        setVisitedWps(prev => new Set([...prev, currentWpIdx]));
      }

      // Interpolate position with slight random deviation to simulate real flight
      const deviation = 0.0008;
      const interpLat = from.lat + (to.lat - from.lat) * stepFraction + (Math.random() - 0.5) * deviation;
      const interpLng = from.lng + (to.lng - from.lng) * stepFraction + (Math.random() - 0.5) * deviation;
      const heading = Math.atan2(to.lng - from.lng, to.lat - from.lat) * (180 / Math.PI);

      setDronePos({ lat: interpLat, lng: interpLng });
      updatePosMut.mutate({ lat: interpLat, lng: interpLng, heading });

      // AI check every 3rd tick
      if (Math.random() < 0.35) {
        checkRoute(interpLat, interpLng, currentWpIdx);
      }
    }, 1200);
  }, [waypoints, updatePosMut, checkRoute, toast]);

  // Stop simulation
  const stopSimulation = useCallback(() => {
    if (simRef.current) clearInterval(simRef.current);
    setSimRunning(false);
    toast({ title: "Simulation stopped" });
  }, [toast]);

  useEffect(() => () => { if (simRef.current) clearInterval(simRef.current); }, []);

  // Default map center: use first waypoint or a sensible default (Miami, common for drone ops)
  const mapCenter: [number, number] = waypoints.length > 0
    ? [waypoints[0].lat, waypoints[0].lng]
    : [25.7617, -80.1918];

  const routeLine = waypoints.map(w => [w.lat, w.lng] as [number, number]);

  const adherenceColor = analysis
    ? { "on-track": "text-green-600", "minor-deviation": "text-yellow-600", "major-deviation": "text-orange-600", "off-route": "text-red-600" }[analysis.status]
    : "text-gray-400";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/use-cases/flyguys")} data-testid="button-back-tracker">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-indigo-500" />
              <span className="font-semibold text-sm">{project?.title ?? "Mission Tracker"}</span>
              {project && <Badge variant="outline" className="text-xs capitalize">{project.status}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{project?.location} · {project?.customerName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {simRunning ? (
            <Button size="sm" variant="destructive" onClick={stopSimulation} data-testid="button-stop-sim">
              <Square className="w-3.5 h-3.5 mr-1" /> Stop
            </Button>
          ) : (
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={startSimulation} disabled={waypoints.length < 2} data-testid="button-start-sim">
              <Play className="w-3.5 h-3.5 mr-1" /> Simulate Flight
            </Button>
          )}
          <Button
            size="sm"
            variant={planningMode ? "default" : "outline"}
            onClick={() => setPlanningMode(p => !p)}
            data-testid="button-toggle-planning"
          >
            <MapPin className="w-3.5 h-3.5 mr-1" />
            {planningMode ? "Stop Planning" : "Plan Route"}
          </Button>
          {waypoints.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => saveWaypointsMut.mutate(waypoints)} disabled={saveWaypointsMut.isPending} data-testid="button-save-waypoints">
              {saveWaypointsMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Save Itinerary"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          {planningMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
              <MapPin className="w-3 h-3" />
              Click map to add waypoints
              <Input
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                placeholder="Waypoint label (optional)"
                className="h-6 text-xs w-36 bg-white/20 border-white/30 text-white placeholder:text-white/70 ml-1"
              />
            </div>
          )}
          <MapContainer
            center={mapCenter}
            zoom={14}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={handleMapClick} planningMode={planningMode} />
            {dronePos && <MapRecenter lat={dronePos.lat} lng={dronePos.lng} follow={followDrone && simRunning} />}

            {/* Planned route polyline */}
            {routeLine.length >= 2 && (
              <Polyline
                positions={routeLine}
                color="#6366f1"
                weight={3}
                opacity={0.8}
                dashArray="8 4"
              />
            )}

            {/* Actual flight path polyline (solid) — built up as drone moves */}
            {dronePos && routeLine.length >= 1 && simRunning && (
              <Polyline
                positions={[...routeLine.slice(0, simWpIndex + 1), [dronePos.lat, dronePos.lng]]}
                color="#10b981"
                weight={2.5}
                opacity={0.9}
              />
            )}

            {/* Waypoint markers */}
            {waypoints.map((wp, i) => (
              <Marker key={i} position={[wp.lat, wp.lng]} icon={i === 0 ? startIcon : waypointIcon(i, visitedWps.has(i))}>
                <Popup>
                  <div className="text-sm font-medium">{wp.label}</div>
                  <div className="text-xs text-gray-500">Waypoint {i + 1} of {waypoints.length}</div>
                  <div className="text-xs text-gray-400">{wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}</div>
                  <button
                    className="mt-1 text-xs text-red-500 hover:underline"
                    onClick={() => setWaypoints(prev => prev.filter((_, idx) => idx !== i).map((w, idx) => ({ ...w, order: idx })))}
                  >Remove</button>
                </Popup>
              </Marker>
            ))}

            {/* Drone position marker */}
            {dronePos && (
              <Marker position={[dronePos.lat, dronePos.lng]} icon={droneIcon}>
                <Popup>
                  <div className="text-sm font-medium">Drone Position</div>
                  <div className="text-xs">{dronePos.lat.toFixed(5)}, {dronePos.lng.toFixed(5)}</div>
                  {analysis && <div className="text-xs mt-1 font-semibold">{analysis.summary}</div>}
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Right panel */}
        <div className="w-80 border-l bg-background flex flex-col overflow-y-auto flex-shrink-0">
          {/* AI Analysis */}
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-semibold">AI Route Monitor</span>
              </div>
              {analyzing && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </div>

            {analysis ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <AdherenceStatus status={analysis.status} />
                  <span className={`text-lg font-bold ${adherenceColor}`}>{analysis.adherenceScore}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${analysis.adherenceScore >= 85 ? "bg-green-500" : analysis.adherenceScore >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${analysis.adherenceScore}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{analysis.summary}</p>
                {analysis.distanceKm !== null && (
                  <div className="flex items-center gap-1 text-xs">
                    <Navigation className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{analysis.distanceKm} km from expected waypoint</span>
                  </div>
                )}
                {analysis.recommendation && (
                  <div className="bg-muted/50 rounded p-2 text-xs">
                    <span className="font-medium">Recommendation: </span>{analysis.recommendation}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-3">
                {simRunning ? "Analyzing route..." : waypoints.length < 2 ? "Add at least 2 waypoints to enable monitoring" : "Start simulation to enable AI monitoring"}
              </div>
            )}
          </div>

          {/* Waypoints list */}
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-semibold">Itinerary ({waypoints.length} waypoints)</span>
              </div>
              {waypoints.length > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-xs text-red-500 px-1"
                  onClick={() => { setWaypoints([]); setDronePos(null); setSimWpIndex(0); setVisitedWps(new Set()); }}>
                  <Trash2 className="w-3 h-3 mr-0.5" /> Clear
                </Button>
              )}
            </div>
            {waypoints.length === 0 ? (
              <p className="text-xs text-muted-foreground">Click "Plan Route" then click on the map to add waypoints</p>
            ) : (
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {waypoints.map((wp, i) => (
                  <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${visitedWps.has(i) ? "bg-green-50 dark:bg-green-900/20" : i === simWpIndex && simRunning ? "bg-indigo-50 dark:bg-indigo-900/20" : "bg-muted/30"}`} data-testid={`waypoint-item-${i}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${visitedWps.has(i) ? "bg-green-500 text-white" : i === simWpIndex && simRunning ? "bg-indigo-500 text-white" : "bg-muted-foreground/20 text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate">{wp.label}</span>
                    {visitedWps.has(i) && <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />}
                    {i === simWpIndex && simRunning && <Zap className="w-3 h-3 text-indigo-500 flex-shrink-0 animate-pulse" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drone live position */}
          {dronePos && (
            <div className="p-3 border-b">
              <div className="flex items-center gap-1.5 mb-2">
                <Navigation className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-semibold">Live Position</span>
                {simRunning && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-auto" />}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Lat</span><p className="font-mono font-medium">{dronePos.lat.toFixed(5)}</p></div>
                <div><span className="text-muted-foreground">Lng</span><p className="font-mono font-medium">{dronePos.lng.toFixed(5)}</p></div>
                <div><span className="text-muted-foreground">Waypoint</span><p className="font-medium">{simWpIndex + 1} / {waypoints.length}</p></div>
                <div>
                  <label className="flex items-center gap-1 text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={followDrone} onChange={e => setFollowDrone(e.target.checked)} className="w-3 h-3" />
                    Follow drone
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Route alerts */}
          <div className="p-3 flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-semibold">Route Alerts</span>
                {allAlerts.length > 0 && (
                  <Badge className="bg-red-100 text-red-700 border-red-200 border text-[10px] px-1 py-0">{allAlerts.length}</Badge>
                )}
              </div>
              {allAlerts.length > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-xs px-1" onClick={() => clearAlertsMut.mutate()} disabled={clearAlertsMut.isPending}>
                  Clear
                </Button>
              )}
            </div>
            {allAlerts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No alerts — drone on planned route</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {allAlerts.map((alert, i) => (
                  <div key={i} className={`flex items-start gap-2 p-2 rounded text-xs ${alert.level === "critical" ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400" : alert.level === "warning" ? "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400" : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"}`} data-testid={`alert-item-${i}`}>
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p>{alert.text}</p>
                      <div className="flex items-center gap-1 mt-0.5 opacity-60">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{alert.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
