/**
 * Shared hook for loading map SVG and Mercator params
 * Used by both NetworkPage and ForkGamePage
 */

import { useState, useEffect } from "react";
import type { MercatorParamsV1 } from "../utils/mercator";
import { validateMercatorParams } from "../utils/mercator";

type MapItem = { id: string; name: string; source: "bundle" | "local" };

function ensureSvgPreserveAspectRatio(svg: string): string {
  if (!svg.trim().startsWith("<svg")) return svg;
  if (/preserveAspectRatio\s*=/.test(svg)) return svg;
  return svg.replace("<svg", '<svg preserveAspectRatio="xMidYMid meet"');
}

function toCamelAttrName(name: string): string | null {
  if (name.includes(":")) return null;
  const lower = name.toLowerCase();
  if (lower === "viewbox") return "viewBox";
  if (lower === "preserveaspectratio") return "preserveAspectRatio";
  if (!name.includes("-")) return name;
  return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function parseInlineStyle(styleText: string): Record<string, string> {
  const style: Record<string, string> = {};
  const chunks = styleText
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  for (const chunk of chunks) {
    const idx = chunk.indexOf(":");
    if (idx === -1) continue;
    const rawKey = chunk.slice(0, idx).trim();
    const value = chunk.slice(idx + 1).trim();
    const key = toCamelAttrName(rawKey);
    if (!key) continue;
    style[key] = value;
  }
  return style;
}

function extractSvgRootAttrs(svg: string): { attrs: Record<string, string> } {
  const attrs: Record<string, string> = {};
  const openIdx = svg.indexOf("<svg");
  if (openIdx === -1) return { attrs };
  const endIdx = svg.indexOf(">", openIdx);
  if (endIdx === -1) return { attrs };
  const raw = svg.slice(openIdx + 4, endIdx);
  const attrRegex = /([a-zA-Z_:][\w:.-]*)\s*=\s*(['"])(.*?)\2/g;
  const skip = new Set([
    "width",
    "height",
    "viewbox",
    "preserveaspectratio",
    "xmlns",
    "xmlns:xlink",
    "xml:space",
    "id",
    "class",
  ]);
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(raw))) {
    const name = m[1];
    const value = m[3] ?? "";
    const lower = name.toLowerCase();
    if (skip.has(lower) || lower.startsWith("xmlns")) continue;
    if (lower === "style") {
      const inline = parseInlineStyle(value);
      Object.entries(inline).forEach(([k, v]) => {
        attrs[k] = v;
      });
      continue;
    }
    const camel = toCamelAttrName(name);
    if (!camel) continue;
    attrs[camel] = value;
  }
  return { attrs };
}

function extractSvgInner(svg: string): string {
  const open = svg.indexOf("<svg");
  if (open === -1) return "";
  const openEnd = svg.indexOf(">", open);
  if (openEnd === -1) return "";
  const close = svg.lastIndexOf("</svg>");
  if (close === -1 || close <= openEnd) return "";
  return svg.slice(openEnd + 1, close).trim();
}

export interface UseMapDataReturn {
  mapParams: MercatorParamsV1 | null;
  mapSvgInner: string;
  mapRootAttrs: Record<string, string>;
  mapViewBox: string;
  selectedMapId: string | null;
  setSelectedMapId: (id: string | null) => void;
  mapItems: MapItem[];
}

export function useMapData(): UseMapDataReturn {
  const [mapItems, setMapItems] = useState<MapItem[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [mapSvgInner, setMapSvgInner] = useState<string>("");
  const [mapRootAttrs, setMapRootAttrs] = useState<Record<string, string>>({});
  const [mapParams, setMapParams] = useState<MercatorParamsV1 | null>(null);
  const [mapViewBox, setMapViewBox] = useState<string>("");

  // Load map list on mount
  useEffect(() => {
    const cancelledRef = { current: false };
    async function refreshMaps() {
      const res = await window.api.maps.list();
      if (!res.ok || cancelledRef.current) return;
      setMapItems(res.items);
      if (res.selectedMapId) {
        setSelectedMapId(res.selectedMapId);
      } else if (res.items.length > 0) {
        setSelectedMapId(res.items[0].id);
      }
    }
    void refreshMaps();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Load selected map
  useEffect(() => {
    let cancelled = false;
    async function loadSelectedMap(id: string) {
      const res = await window.api.maps.load({ id });
      if (!res.ok || cancelled) return;

      const svg = ensureSvgPreserveAspectRatio(res.svg);
      setMapSvgInner(extractSvgInner(svg));
      const { attrs } = extractSvgRootAttrs(svg);
      setMapRootAttrs(attrs);

      try {
        const parsedParams = validateMercatorParams(JSON.parse(res.params));
        setMapParams(parsedParams);
      } catch {
        setMapParams(null);
      }

      const viewBoxMatch = res.svg.match(/viewBox\s*=\s*['"]([^'"]+)['"]/i);
      const viewBox = viewBoxMatch ? viewBoxMatch[1] : "";
      setMapViewBox(viewBox);
    }

    if (selectedMapId) {
      void loadSelectedMap(selectedMapId);
    }

    return () => {
      cancelled = true;
    };
  }, [selectedMapId]);

  return {
    mapParams,
    mapSvgInner,
    mapRootAttrs,
    mapViewBox,
    selectedMapId,
    setSelectedMapId,
    mapItems,
  };
}
