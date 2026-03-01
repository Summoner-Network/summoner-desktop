import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ConnectionStatus } from "../App";
import { formatValue } from "../utils/message";
import { latLonToPixel, validateMercatorParams } from "../utils/mercator";

type RemoteAgent = {
  addr: string;
  firstSeen: number;
  lastSeen: number;
  lastContent?: unknown;
  lastSeenServerId?: string;
};

type MapItem = { id: string; name: string; source: "bundle" | "local" };
type GeoInfo = { lat: number; lon: number; city?: string; country?: string };
type ViewBoxRect = { x: number; y: number; width: number; height: number };
const SHOW_MAP_DEBUG = false;

function extractIpv4(addr: string): string | null {
  const match = addr.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
  if (!match) return null;
  const parts = match[1].split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return match[1];
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  return false;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ensureSvgPreserveAspectRatio(svg: string): string {
  if (!svg.trim().startsWith("<svg")) return svg;
  if (/preserveAspectRatio\s*=/.test(svg)) return svg;
  return svg.replace("<svg", '<svg preserveAspectRatio="xMidYMid meet"');
}

function extractSvgInner(svg: string): string {
  const openIdx = svg.indexOf("<svg");
  if (openIdx === -1) return svg;
  const start = svg.indexOf(">", openIdx);
  const end = svg.lastIndexOf("</svg>");
  if (start === -1 || end === -1 || end <= start) return svg;
  return svg.slice(start + 1, end);
}

function parseSvgDimensions(svg: string): { width: number; height: number } | null {
  const widthMatch = svg.match(/width\s*=\s*['"]([\d.]+)(px)?['"]/i);
  const heightMatch = svg.match(/height\s*=\s*['"]([\d.]+)(px)?['"]/i);
  if (!widthMatch || !heightMatch) return null;
  const width = Number(widthMatch[1]);
  const height = Number(heightMatch[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function getViewBoxFit(
  stage: DOMRect,
  viewBox: { x: number; y: number; width: number; height: number }
): { offsetX: number; offsetY: number; width: number; height: number } {
  const scale = Math.min(stage.width / viewBox.width, stage.height / viewBox.height);
  const width = viewBox.width * scale;
  const height = viewBox.height * scale;
  const offsetX = (stage.width - width) / 2;
  const offsetY = (stage.height - height) / 2;
  return { offsetX, offsetY, width, height };
}

function computeFittedViewBox(
  stage: DOMRect,
  base: ViewBoxRect
): { view: ViewBoxRect; minScale: number } {
  const arStage = stage.width / stage.height;
  const arMap = base.width / base.height;
  let viewWidth = base.width;
  let viewHeight = base.height;
  if (arStage > arMap) {
    viewHeight = base.width / arStage;
  } else {
    viewWidth = base.height * arStage;
  }
  const x = base.x + (base.width - viewWidth) / 2;
  const y = base.y + (base.height - viewHeight) / 2;
  const scale = base.width / viewWidth;
  return { view: { x, y, width: viewWidth, height: viewHeight }, minScale: scale };
}

function formatRect(label: string, rect: ViewBoxRect | null): string {
  if (!rect) return `${label}: null`;
  return `${label}: x=${rect.x.toFixed(2)} y=${rect.y.toFixed(2)} w=${rect.width.toFixed(2)} h=${rect.height.toFixed(2)}`;
}

function normalizeWheelDelta(deltaY: number, deltaMode: number, stageHeight: number): number {
  if (deltaMode === 1) return deltaY * 16;
  if (deltaMode === 2) return deltaY * stageHeight;
  return deltaY;
}

export default function NetworkPage(props: {
  remoteByAddr: Record<string, RemoteAgent>;
  selectedRemoteAddr: string | null;
  onSelectRemoteAddr: (addr: string) => void;
  serverById: Record<string, { name: string; host: string; port: number }>;
  serverStatusById: Record<string, ConnectionStatus>;
}) {
  const { remoteByAddr, selectedRemoteAddr, onSelectRemoteAddr, serverById, serverStatusById } = props;
  const agents = Object.values(remoteByAddr).sort((a, b) => b.lastSeen - a.lastSeen);
  const selected = selectedRemoteAddr ? remoteByAddr[selectedRemoteAddr] : agents[0];
  const [mapItems, setMapItems] = useState<MapItem[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [mapSvg, setMapSvg] = useState<string>("");
  const [mapSvgInner, setMapSvgInner] = useState<string>("");
  const [mapParams, setMapParams] = useState<ReturnType<typeof validateMercatorParams> | null>(null);
  const [mapViewBox, setMapViewBox] = useState<string>("");
  const [mapRawViewBox, setMapRawViewBox] = useState<string>("");
  const [baseViewBoxRect, setBaseViewBoxRect] = useState<ViewBoxRect | null>(null);
  const [currentViewBoxRect, setCurrentViewBoxRect] = useState<ViewBoxRect | null>(null);
  const [minScale, setMinScale] = useState(1);
  const [debugInfo, setDebugInfo] = useState("");
  const [geoByIp, setGeoByIp] = useState<Record<string, GeoInfo>>({});
  const pendingLookups = useRef<Set<string>>(new Set());
  const geoRef = useRef<Record<string, GeoInfo>>({});
  const mapStageRef = useRef<HTMLDivElement | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<{ label: string; x: number; y: number } | null>(null);
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [hoveredServerId, setHoveredServerId] = useState<string | null>(null);
  const isPanningRef = useRef(false);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const baseViewBoxRef = useRef<ViewBoxRect | null>(null);
  const currentViewBoxRef = useRef<ViewBoxRect | null>(null);
  const minScaleRef = useRef(1);
  const hasUserInteractedRef = useRef(false);
  const fitRafRef = useRef<number | null>(null);
  const fittedViewRef = useRef<ViewBoxRect | null>(null);
  const wheelStateRef = useRef<{
    accum: number;
    rafId: number;
    lastEvent: { clientX: number; clientY: number } | null;
    lastDir: number;
    lastTs: number;
  }>({ accum: 0, rafId: 0, lastEvent: null, lastDir: 0, lastTs: 0 });

  useEffect(() => {
    geoRef.current = geoByIp;
  }, [geoByIp]);

  async function refreshMaps(cancelledRef?: { current: boolean }) {
    const res = await window.api.maps.list();
    if (!res.ok || cancelledRef?.current) return;
    setMapItems(res.items);
    if (res.selectedMapId) {
      setSelectedMapId(res.selectedMapId);
    } else if (res.items.length > 0) {
      setSelectedMapId(res.items[0].id);
    }
  }

  useEffect(() => {
    const cancelledRef = { current: false };
    void refreshMaps(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSelectedMap(id: string) {
      const res = await window.api.maps.load({ id });
      if (!res.ok || cancelled) return;
      const svg = ensureSvgPreserveAspectRatio(res.svg);
      setMapSvg(svg);
      setMapSvgInner(extractSvgInner(svg));
      let parsedParams: ReturnType<typeof validateMercatorParams> | null = null;
      try {
        parsedParams = validateMercatorParams(JSON.parse(res.params));
        setMapParams(parsedParams);
      } catch {
        parsedParams = null;
        setMapParams(null);
      }
      const viewBoxMatch = res.svg.match(/viewBox\s*=\s*['"]([^'"]+)['"]/i);
      const viewBox = viewBoxMatch ? viewBoxMatch[1] : "";
      setMapRawViewBox(viewBox);
      setMapViewBox(viewBox);
      if (viewBox) {
        const parts = viewBox.split(/\s+/).map((v) => Number(v));
        if (parts.length === 4 && parts.every((v) => Number.isFinite(v))) {
          const base = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
          setBaseViewBoxRect(base);
          baseViewBoxRef.current = base;
          setCurrentViewBoxRect(null);
          currentViewBoxRef.current = null;
          hasUserInteractedRef.current = false;
        }
      } else {
        const dims = parseSvgDimensions(res.svg);
        if (dims) {
          const base = { x: 0, y: 0, width: dims.width, height: dims.height };
          setBaseViewBoxRect(base);
          baseViewBoxRef.current = base;
          setCurrentViewBoxRect(null);
          currentViewBoxRef.current = null;
          hasUserInteractedRef.current = false;
          setMapViewBox(`0 0 ${dims.width} ${dims.height}`);
        } else if (parsedParams?.worldRectViewBox) {
          const r = parsedParams.worldRectViewBox;
          const base = { x: r.x0, y: r.y0, width: r.width, height: r.height };
          setBaseViewBoxRect(base);
          baseViewBoxRef.current = base;
          setCurrentViewBoxRect(null);
          currentViewBoxRef.current = null;
          hasUserInteractedRef.current = false;
          setMapViewBox(`${r.x0} ${r.y0} ${r.width} ${r.height}`);
        } else {
          setBaseViewBoxRect(null);
          setCurrentViewBoxRect(null);
          baseViewBoxRef.current = null;
          currentViewBoxRef.current = null;
          hasUserInteractedRef.current = false;
        }
      }
    }
    if (selectedMapId) {
      void loadSelectedMap(selectedMapId);
    }
    return () => {
      cancelled = true;
    };
  }, [selectedMapId]);

  useEffect(() => {
    const ips = new Set(agents.map((a) => a.addr).filter(Boolean));
    Object.values(serverById).forEach((server) => {
      if (server?.host) ips.add(server.host);
    });
    ips.forEach((addr) => {
      const ipv4 = extractIpv4(addr);
      if (!ipv4 || isPrivateIpv4(ipv4)) return;
      if (geoRef.current[ipv4] || pendingLookups.current.has(ipv4)) return;
      pendingLookups.current.add(ipv4);
      window.api.maps
        .geoLookup({ ip: ipv4 })
        .then((res) => {
          if (!res.ok) return;
          setGeoByIp((prev) => ({ ...prev, [ipv4]: { lat: res.lat, lon: res.lon, city: res.city, country: res.country } }));
        })
        .finally(() => {
          pendingLookups.current.delete(ipv4);
        });
    });
  }, [agents, serverById]);

  const overlayViewBox = useMemo(() => mapViewBox || mapRawViewBox, [mapRawViewBox, mapViewBox]);

  useLayoutEffect(() => {
    if (!baseViewBoxRect || !mapStageRef.current) return;
    const stage = mapStageRef.current;
    const update = () => {
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const fitted = computeFittedViewBox(rect, baseViewBoxRect);
      fittedViewRef.current = fitted.view;
      if (!hasUserInteractedRef.current && !currentViewBoxRef.current) {
        setCurrentViewBoxRect(fitted.view);
        currentViewBoxRef.current = fitted.view;
      }
      setMinScale(fitted.minScale);
      minScaleRef.current = fitted.minScale;
      if (SHOW_MAP_DEBUG) {
        const view = currentViewBoxRef.current ?? fitted.view;
        const scale = baseViewBoxRect.width / view.width;
        setDebugInfo(
          [
            formatRect("base", baseViewBoxRect),
            formatRect("current", view),
            `minScale=${fitted.minScale.toFixed(3)} scale=${scale.toFixed(3)}`
          ].join("\n")
        );
      }
    };
    const tick = () => {
      update();
      if (!currentViewBoxRef.current) {
        fitRafRef.current = window.requestAnimationFrame(tick);
      } else if (fitRafRef.current) {
        window.cancelAnimationFrame(fitRafRef.current);
        fitRafRef.current = null;
      }
    };
    tick();
    const ro = new ResizeObserver(update);
    ro.observe(stage);
    return () => {
      ro.disconnect();
      if (fitRafRef.current) {
        window.cancelAnimationFrame(fitRafRef.current);
        fitRafRef.current = null;
      }
    };
  }, [baseViewBoxRect]);

  useEffect(() => {
    const stage = mapStageRef.current;
    if (!stage) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const base = baseViewBoxRef.current;
      const rect = stage.getBoundingClientRect();
      if (!base || !rect) return;
      hasUserInteractedRef.current = true;
      const delta = normalizeWheelDelta(event.deltaY, event.deltaMode, rect.height);
      const wheelState = wheelStateRef.current;
      const now = performance.now();
      const dir = Math.sign(delta);
      if (dir !== 0) {
        const recentFlip = wheelState.lastDir !== 0 && dir !== wheelState.lastDir && now - wheelState.lastTs < 120;
        const isTiny = Math.abs(delta) < 20;
        if (recentFlip && isTiny) {
          return;
        }
        wheelState.lastDir = dir;
        wheelState.lastTs = now;
      }
      wheelState.accum += delta;
      wheelState.lastEvent = { clientX: event.clientX, clientY: event.clientY };
      if (wheelState.rafId) return;
      wheelState.rafId = window.requestAnimationFrame(() => {
        wheelState.rafId = 0;
        const stageRect = stage.getBoundingClientRect();
        const currentForZoom = currentViewBoxRef.current ?? fittedViewRef.current ?? computeFittedViewBox(stageRect, base).view;
        if (!currentForZoom) return;
        const accumulated = wheelState.accum;
        wheelState.accum = 0;
        if (Math.abs(accumulated) < 0.5) return;
        const zoomIntensity = 0.002;
        const zoomFactor = Math.exp(-accumulated * zoomIntensity);
        const maxScale = 6;
        const aspect = currentForZoom.width / currentForZoom.height;
        const minWidth = (fittedViewRef.current ?? currentForZoom).width;
        const maxWidth = base.width / maxScale;
        let nextWidth = currentForZoom.width / zoomFactor;
        nextWidth = clamp(nextWidth, maxWidth, minWidth);
        const nextHeight = nextWidth / aspect;
        const fit = getViewBoxFit(stageRect, currentForZoom);
        const cursor = wheelState.lastEvent ?? {
          clientX: stageRect.left + stageRect.width / 2,
          clientY: stageRect.top + stageRect.height / 2
        };
        const cursorX = cursor.clientX - stageRect.left;
        const cursorY = cursor.clientY - stageRect.top;
        const localX = clamp(cursorX - fit.offsetX, 0, fit.width);
        const localY = clamp(cursorY - fit.offsetY, 0, fit.height);
        const u = currentForZoom.x + (localX / fit.width) * currentForZoom.width;
        const v = currentForZoom.y + (localY / fit.height) * currentForZoom.height;
        const nx = clamp(u - (localX / fit.width) * nextWidth, base.x, base.x + base.width - nextWidth);
        const ny = clamp(v - (localY / fit.height) * nextHeight, base.y, base.y + base.height - nextHeight);
        const next = { x: nx, y: ny, width: nextWidth, height: nextHeight };
        setCurrentViewBoxRect(next);
        currentViewBoxRef.current = next;
        hasUserInteractedRef.current = true;
        if (SHOW_MAP_DEBUG) {
          const scale = base.width / next.width;
          setDebugInfo(
            [
              formatRect("base", base),
              formatRect("current", next),
              `minScale=${minScaleRef.current.toFixed(3)} scale=${scale.toFixed(3)}`,
              `accum=${accumulated.toFixed(2)} zoomFactor=${zoomFactor.toFixed(4)}`
            ].join("\n")
          );
        }
      });
    };
    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", handleWheel);
    };
  }, [mapStageRef.current]);

  const markers = useMemo(() => {
    if (!mapParams) return [];
    return agents
      .map((agent) => {
        const ipv4 = extractIpv4(agent.addr);
        if (!ipv4 || isPrivateIpv4(ipv4)) return null;
        const geo = geoByIp[ipv4];
        if (!geo) return null;
        const projected = latLonToPixel(geo.lat, geo.lon, mapParams);
        if (projected.outside && mapParams.flags?.rejectOutsideMap) return null;
        const x = projected.x;
        const y = projected.y;
        const recent = Date.now() - agent.lastSeen <= 60_000;
        return {
          id: agent.addr,
          ip: ipv4,
          x,
          y,
          selected: agent.addr === selected?.addr,
          recent,
          label: geo.city && geo.country ? `${ipv4} • ${geo.city}, ${geo.country}` : geo.country
            ? `${ipv4} • ${geo.country}`
            : ipv4
        };
      })
      .filter(Boolean) as { id: string; ip: string; x: number; y: number; selected: boolean; recent: boolean; label: string }[];
  }, [agents, geoByIp, mapParams, selected?.addr]);

  const serverMarkers = useMemo(() => {
    if (!mapParams) return [];
    return Object.entries(serverById)
      .map(([id, server]) => {
        const ipv4 = extractIpv4(server.host);
        if (!ipv4 || isPrivateIpv4(ipv4)) return null;
        const geo = geoByIp[ipv4];
        if (!geo) return null;
        const projected = latLonToPixel(geo.lat, geo.lon, mapParams);
        if (projected.outside && mapParams.flags?.rejectOutsideMap) return null;
        const connected = serverStatusById[id] === "connected";
        return {
          id,
          name: server.name,
          host: server.host,
          ip: ipv4,
          x: projected.x,
          y: projected.y,
          connected
        };
      })
      .filter(Boolean) as { id: string; name: string; host: string; ip: string; x: number; y: number; connected: boolean }[];
  }, [serverById, serverStatusById, geoByIp, mapParams]);

  const serverMarkerById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; host: string; ip: string; x: number; y: number; connected: boolean }>();
    serverMarkers.forEach((s) => map.set(s.id, s));
    return map;
  }, [serverMarkers]);

  const agentMarkerById = useMemo(() => {
    const map = new Map<string, { id: string; ip: string; x: number; y: number; label: string }>();
    markers.forEach((m) => map.set(m.id, m));
    return map;
  }, [markers]);

  const hoverLinks = useMemo(() => {
    const links: Array<{ ax: number; ay: number; sx: number; sy: number; cx: number; cy: number; key: string }> = [];
    if (hoveredAgentId) {
      const agent = agentMarkerById.get(hoveredAgentId);
      const agentData = agents.find((a) => a.addr === hoveredAgentId);
      if (agent && agentData?.lastSeenServerId) {
        const server = serverMarkerById.get(agentData.lastSeenServerId);
        if (server) {
          const mx = (agent.x + server.x) / 2;
          const my = (agent.y + server.y) / 2 - 40;
          links.push({ ax: agent.x, ay: agent.y, sx: server.x, sy: server.y, cx: mx, cy: my, key: `agent-${agent.id}` });
        }
      }
    }
    return links;
  }, [agentMarkerById, agents, hoveredAgentId, selected?.addr, serverMarkerById]);

  const mapStats = useMemo(() => {
    const all = agents.length;
    let privateCount = 0;
    let withIpv4 = 0;
    agents.forEach((agent) => {
      const ipv4 = extractIpv4(agent.addr);
      if (!ipv4) return;
      withIpv4 += 1;
      if (isPrivateIpv4(ipv4)) privateCount += 1;
    });
    const plotted = markers.length;
    return { all, withIpv4, privateCount, plotted };
  }, [agents, markers.length]);


  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="title">Network</div>
          <div className="subtitle">Agents discovered on remote servers.</div>
        </div>
      </div>

      <div className="panel map-panel">
        <div className="panel-title-row">
          <div className="panel-title">Map View</div>
          <div className="map-toolbar">
            <select
              className="map-select"
              value={selectedMapId ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedMapId(id);
                void window.api.maps.select({ id });
              }}
            >
              {mapItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.source === "local" ? "(local)" : ""}
                </option>
              ))}
            </select>
            <button
              className="map-add-btn"
              type="button"
              onClick={async () => {
                await window.api.maps.openFolder();
                await refreshMaps();
              }}
            >
              Add map
            </button>
            <div className="map-zoom">
              <button
                className="map-zoom-btn"
                type="button"
                onClick={() => {
                  if (!currentViewBoxRef.current || !baseViewBoxRef.current) return;
                  hasUserInteractedRef.current = true;
                  const current = currentViewBoxRef.current;
                  const base = baseViewBoxRef.current;
                  const maxScale = 6;
                  const aspect = current.width / current.height;
                  const minWidth = (fittedViewRef.current ?? current).width;
                  const maxWidth = base.width / maxScale;
                  let nextWidth = current.width / 1.06;
                  nextWidth = clamp(nextWidth, maxWidth, minWidth);
                  const nextHeight = nextWidth / aspect;
                  const cx = current.x + current.width / 2;
                  const cy = current.y + current.height / 2;
                  const nx = clamp(cx - nextWidth / 2, base.x, base.x + base.width - nextWidth);
                  const ny = clamp(cy - nextHeight / 2, base.y, base.y + base.height - nextHeight);
                  const next = { x: nx, y: ny, width: nextWidth, height: nextHeight };
                  setCurrentViewBoxRect(next);
                  currentViewBoxRef.current = next;
                }}
              >
                +
              </button>
              <button
                className="map-zoom-btn"
                type="button"
                onClick={() => {
                  if (!currentViewBoxRef.current || !baseViewBoxRef.current) return;
                  hasUserInteractedRef.current = true;
                  const current = currentViewBoxRef.current;
                  const base = baseViewBoxRef.current;
                  const aspect = current.width / current.height;
                  const minWidth = (fittedViewRef.current ?? current).width;
                  const maxWidth = base.width / 6;
                  let nextWidth = current.width * 1.06;
                  nextWidth = clamp(nextWidth, maxWidth, minWidth);
                  const nextHeight = nextWidth / aspect;
                  const cx = current.x + current.width / 2;
                  const cy = current.y + current.height / 2;
                  const nx = clamp(cx - nextWidth / 2, base.x, base.x + base.width - nextWidth);
                  const ny = clamp(cy - nextHeight / 2, base.y, base.y + base.height - nextHeight);
                  const next = { x: nx, y: ny, width: nextWidth, height: nextHeight };
                  setCurrentViewBoxRect(next);
                  currentViewBoxRef.current = next;
                }}
              >
                −
              </button>
              <button
                className="map-zoom-btn"
                type="button"
                onClick={() => {
                  if (!baseViewBoxRef.current) return;
                  hasUserInteractedRef.current = false;
                  const base = baseViewBoxRef.current;
                  const stage = mapStageRef.current;
                  if (!stage) {
                    setCurrentViewBoxRect(base);
                    currentViewBoxRef.current = base;
                    return;
                  }
                  const rect = stage.getBoundingClientRect();
                  if (!rect.width || !rect.height) {
                    setCurrentViewBoxRect(base);
                    currentViewBoxRef.current = base;
                    return;
                  }
                  const fitted = computeFittedViewBox(rect, base);
                  setCurrentViewBoxRect(fitted.view);
                  currentViewBoxRef.current = fitted.view;
                  setMinScale(fitted.minScale);
                  minScaleRef.current = fitted.minScale;
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
        <div className="map-frame">
          {mapSvg ? (
            <div
              className="map-stage"
              ref={mapStageRef}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                hasUserInteractedRef.current = true;
                isPanningRef.current = true;
                lastPanRef.current = { x: e.clientX, y: e.clientY };
              }}
              onMouseMove={(e) => {
                if (!isPanningRef.current || !lastPanRef.current) return;
                const rect = mapStageRef.current?.getBoundingClientRect();
                if (!rect || !currentViewBoxRect || !baseViewBoxRect) return;
                const dxPx = e.clientX - lastPanRef.current.x;
                const dyPx = e.clientY - lastPanRef.current.y;
                lastPanRef.current = { x: e.clientX, y: e.clientY };
                const fit = getViewBoxFit(rect, currentViewBoxRect);
                const dxVb = (dxPx / fit.width) * currentViewBoxRect.width;
                const dyVb = (dyPx / fit.height) * currentViewBoxRect.height;
                const nx = clamp(currentViewBoxRect.x - dxVb, baseViewBoxRect.x, baseViewBoxRect.x + baseViewBoxRect.width - currentViewBoxRect.width);
                const ny = clamp(currentViewBoxRect.y - dyVb, baseViewBoxRect.y, baseViewBoxRect.y + baseViewBoxRect.height - currentViewBoxRect.height);
                const next = { ...currentViewBoxRect, x: nx, y: ny };
                setCurrentViewBoxRect(next);
                currentViewBoxRef.current = next;
              }}
              onMouseUp={() => {
                isPanningRef.current = false;
                lastPanRef.current = null;
              }}
              onMouseLeave={() => {
                isPanningRef.current = false;
                lastPanRef.current = null;
              }}
            >
              <svg
                className="map-canvas"
                viewBox={
                  currentViewBoxRect
                    ? `${currentViewBoxRect.x} ${currentViewBoxRect.y} ${currentViewBoxRect.width} ${currentViewBoxRect.height}`
                    : overlayViewBox || undefined
                }
                preserveAspectRatio="xMidYMid meet"
                style={currentViewBoxRect ? undefined : { opacity: 0 }}
              >
                <g dangerouslySetInnerHTML={{ __html: mapSvgInner }} />
                {currentViewBoxRect ? (
                  <>
                    {serverMarkers.map((s) => (
                      <g key={`server-${s.id}`} className="map-server">
                        {s.connected ? (
                          <circle className="map-server-pulse connected" cx={s.x} cy={s.y} r={8}>
                            <animate attributeName="r" values="6;18" dur="2.8s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.8;0" dur="2.8s" repeatCount="indefinite" />
                          </circle>
                        ) : null}
                        <rect
                          className="map-server-marker"
                          x={s.x - 5}
                          y={s.y - 5}
                          width={10}
                          height={10}
                          rx={2}
                          ry={2}
                          transform={`rotate(45 ${s.x} ${s.y})`}
                          onMouseEnter={(e) => {
                            setHoveredServerId(s.id);
                            const rect = mapStageRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            setHoveredMarker({ label: `${s.name} • ${s.host}`, x: e.clientX - rect.left, y: e.clientY - rect.top });
                          }}
                          onMouseMove={(e) => {
                            const rect = mapStageRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            setHoveredMarker({ label: `${s.name} • ${s.host}`, x: e.clientX - rect.left, y: e.clientY - rect.top });
                          }}
                          onMouseLeave={() => {
                            setHoveredServerId((prev) => (prev === s.id ? null : prev));
                            setHoveredMarker(null);
                          }}
                        />
                      </g>
                    ))}
                    {markers.map((m) => (
                      <g key={m.id}>
                        {m.recent ? (
                          <circle className="map-marker-pulse" cx={m.x} cy={m.y} r={m.selected ? 12 : 10}>
                            <animate attributeName="r" values="10;22" dur="2.4s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.8;0" dur="2.4s" repeatCount="indefinite" />
                          </circle>
                        ) : null}
                        <circle
                          className={`map-marker ${m.selected ? "selected" : ""}`}
                          cx={m.x}
                          cy={m.y}
                          r={m.selected ? 7 : 5}
                          onClick={() => onSelectRemoteAddr(m.id)}
                          onMouseEnter={(e) => {
                            setHoveredAgentId(m.id);
                            const rect = mapStageRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            setHoveredMarker({ label: m.label, x: e.clientX - rect.left, y: e.clientY - rect.top });
                          }}
                          onMouseMove={(e) => {
                            const rect = mapStageRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            setHoveredMarker({ label: m.label, x: e.clientX - rect.left, y: e.clientY - rect.top });
                          }}
                          onMouseLeave={() => {
                            setHoveredAgentId((prev) => (prev === m.id ? null : prev));
                            setHoveredMarker(null);
                          }}
                        />
                      </g>
                    ))}
                    {hoverLinks.map((link) => (
                      <path
                        key={link.key}
                        className="map-link hover"
                        d={`M ${link.ax} ${link.ay} Q ${link.cx} ${link.cy} ${link.sx} ${link.sy}`}
                      >
                        <animate attributeName="stroke-opacity" values="0.2;0.9;0.2" dur="1.8s" repeatCount="indefinite" />
                      </path>
                    ))}
                  </>
                ) : null}
              </svg>
              {!currentViewBoxRect ? <div className="small">Loading map...</div> : null}
              {hoveredMarker ? (
                <div className="map-tooltip" style={{ left: hoveredMarker.x, top: hoveredMarker.y }}>
                  {hoveredMarker.label}
                </div>
              ) : null}
              {SHOW_MAP_DEBUG ? (
                <pre className="map-debug">
                  {debugInfo || "map debug: waiting..."}
                </pre>
              ) : null}
            </div>
          ) : (
            <div className="small">Loading map...</div>
          )}
        </div>
        <div className="map-meta">
          <div className="small">
            Plotted: {mapStats.plotted} / {mapStats.all}
          </div>
          {mapStats.privateCount > 0 ? (
            <div className="small">Private IPs (not geolocated): {mapStats.privateCount}</div>
          ) : null}
        </div>
      </div>

      <div className="page-grid">
        <div className="panel">
          <div className="panel-title">My Network</div>
          <div className="panel-list">
            {agents.length === 0 ? (
              <div className="small">No remote agents detected yet.</div>
            ) : null}
            {agents.map((agent) => (
              <div
                key={agent.addr}
                className={`panel-item ${agent.addr === selected?.addr ? "selected" : ""}`}
                onClick={() => onSelectRemoteAddr(agent.addr)}
                role="button"
                tabIndex={0}
              >
                <div className="fw600">{agent.addr}</div>
                <div className="small">Last seen: {new Date(agent.lastSeen).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Agent Detail</div>
          {selected ? (
            <div className="detail-grid">
              <div className="detail-row">
                <span className="detail-label">Address</span>
                <span className="detail-value">{selected.addr}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">First seen</span>
                <span className="detail-value">{new Date(selected.firstSeen).toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Last seen</span>
                <span className="detail-value">{new Date(selected.lastSeen).toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Last seen on server</span>
                <span className="detail-value">
                  {selected.lastSeenServerId && serverById[selected.lastSeenServerId]
                    ? `${serverById[selected.lastSeenServerId].name} (${serverById[selected.lastSeenServerId].host}:${serverById[selected.lastSeenServerId].port})`
                    : selected.lastSeenServerId ?? "Unknown"}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Last content</span>
                <pre className="detail-pre">
                  {selected.lastContent === undefined ? "No structured payload yet." : formatValue(selected.lastContent)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="small">Select a remote agent to view details.</div>
          )}
        </div>
      </div>
    </div>
  );
}
