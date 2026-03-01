export type RectVb = {
  x0: number;
  y0: number;
  width: number;
  height: number;
};

export type MercatorParamsV1 = {
  version: 1;
  projection: "mercator";
  lonLeftDeg: number;
  lonRightDeg: number;
  latTopDeg: number;
  latBottomDeg: number;
  // Kept for backward compatibility with older desktop payloads.
  pixelRect?: RectVb;
  // Canonical key used by current web trainer.
  worldRectViewBox?: RectVb;
  wrapLongitude?: boolean;
  flags?: {
    rejectOutsideMap?: boolean;
  };
};

export type ProjectedPoint = {
  x: number;
  y: number;
  u: number;
  v: number;
  outsideLon: boolean;
  outsideLat: boolean;
  outside: boolean;
  meta: {
    lonInput: number;
    lonProjected: number;
    latInput: number;
    latProjected: number;
    wasWrapped: boolean;
    wasLatClamped: boolean;
  };
};

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function finiteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

// Mercator y = ln(tan(pi/4 + phi/2))
function mercatorY(latDeg: number): number {
  const phi = degToRad(latDeg);
  return Math.log(Math.tan(Math.PI / 4 + phi / 2));
}

function wrapLongitude(lonDeg: number, lonLeftDeg: number, lonRightDeg: number): number {
  const span = lonRightDeg - lonLeftDeg;
  if (span <= 0) return lonDeg;
  let lon = lonDeg;
  lon = ((lon - lonLeftDeg) % span + span) % span + lonLeftDeg;
  if (lon > lonRightDeg) lon -= span;
  return lon;
}

function getRect(params: MercatorParamsV1): RectVb {
  const r = params.worldRectViewBox ?? params.pixelRect;
  if (!r) {
    throw new Error("Missing worldRectViewBox (or legacy pixelRect) in params.");
  }
  return r;
}

export function validateMercatorParams(params: MercatorParamsV1): MercatorParamsV1 {
  if (params?.projection !== "mercator" || params?.version !== 1) {
    throw new Error("Invalid mercator params file.");
  }

  const rect = getRect(params);
  const required = [
    params.lonLeftDeg,
    params.lonRightDeg,
    params.latTopDeg,
    params.latBottomDeg,
    rect.x0,
    rect.y0,
    rect.width,
    rect.height
  ];

  if (!required.every(finiteNumber)) {
    throw new Error("Params contain non-finite numeric values.");
  }
  if (params.lonRightDeg <= params.lonLeftDeg) {
    throw new Error("Invalid longitude range (lonRightDeg must be > lonLeftDeg).");
  }
  if (params.latTopDeg <= params.latBottomDeg) {
    throw new Error("Invalid latitude range (latTopDeg must be > latBottomDeg).");
  }
  if (Math.abs(params.latTopDeg) >= 89.999 || Math.abs(params.latBottomDeg) >= 89.999) {
    throw new Error("Latitude bounds must stay away from +/-90 for Mercator stability.");
  }
  return params;
}

export function latLonToPixel(latDeg: number, lonDeg: number, params: MercatorParamsV1): ProjectedPoint {
  validateMercatorParams(params);

  const lonLeft = params.lonLeftDeg;
  const lonRight = params.lonRightDeg;
  const latTop = params.latTopDeg;
  const latBottom = params.latBottomDeg;
  const wrapLon = params.wrapLongitude !== false;
  const rect = getRect(params);

  const inLonRange = lonDeg >= lonLeft && lonDeg <= lonRight;
  const inLatRange = latDeg >= latBottom && latDeg <= latTop;

  let lon = lonDeg;
  if (wrapLon) lon = wrapLongitude(lon, lonLeft, lonRight);

  const u = (lon - lonLeft) / (lonRight - lonLeft);

  const lat = clamp(latDeg, latBottom, latTop);
  const yTop = mercatorY(latTop);
  const yBottom = mercatorY(latBottom);
  const yLat = mercatorY(lat);
  const v = (yTop - yLat) / (yTop - yBottom);

  const x = rect.x0 + u * rect.width;
  const y = rect.y0 + v * rect.height;

  const outsideLon = wrapLon ? false : !inLonRange;
  const outsideLat = !inLatRange;

  return {
    x,
    y,
    u,
    v,
    outsideLon,
    outsideLat,
    outside: outsideLon || outsideLat,
    meta: {
      lonInput: lonDeg,
      lonProjected: lon,
      latInput: latDeg,
      latProjected: lat,
      wasWrapped: wrapLon && Math.abs(lon - lonDeg) > 1e-12,
      wasLatClamped: Math.abs(lat - latDeg) > 1e-12
    }
  };
}

export function createMercatorProjector(params: MercatorParamsV1) {
  validateMercatorParams(params);
  return (latDeg: number, lonDeg: number): ProjectedPoint => latLonToPixel(latDeg, lonDeg, params);
}

export async function loadMercatorParamsFromUrl(url: string): Promise<MercatorParamsV1> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load params: ${res.status} ${res.statusText}`);
  const p = (await res.json()) as MercatorParamsV1;
  return validateMercatorParams(p);
}
