import { ipcMain, BrowserWindow, shell } from "electron";
import type { ServerProfile } from "./preload";
import { TcpManager } from "./tcp/TcpManager";
import path from "node:path";
import os from "node:os";
import { execFile, spawn } from "node:child_process";
import { promises as fs, readFileSync, constants as fsConstants } from "node:fs";

const BUNDLE_REPOS: Record<string, string> = {
  agentclass: "https://github.com/Summoner-Network/extension-agentclass.git",
  utilities: "https://github.com/Summoner-Network/extension-utilities.git"
};

const REPO_TO_BUNDLE: Record<string, string> = {
  "https://github.com/Summoner-Network/extension-agentclass.git": "agentclass",
  "https://github.com/Summoner-Network/extension-utilities.git": "utilities"
};

const PROJECT_META_FILE = "app.summoner.project.json";
const AGENT_PREFIX = "agent_";
const MAX_LOG_LINES = 3000;
const MAPS_META_FILE = "app.summoner.maps.json";
const GEO_CACHE_FILE = "app.summoner.geo.json";
const SERVERS_STATE_FILE = "app.summoner.servers.json";
const SETTINGS_FILE = "app.summoner.settings.json";
const GEO_RATE_LIMIT = 45;
const GEO_RATE_WINDOW_MS = 60_000;

const isDev = !!process.env.ELECTRON_RENDERER_URL;

type ServerLogEntry = { ts: number; direction: "in" | "out"; raw: string };
const logStore = new Map<string, { loaded: boolean; lines: string[] }>();
const logQueues = new Map<string, Promise<void>>();
const geoCache = new Map<string, { lat: number; lon: number; city?: string; country?: string; ts: number }>();
const geoRequests: number[] = [];
let geoQueue: Promise<void> = Promise.resolve();
let geoCacheLoaded = false;
let geoCacheWriteTimer: NodeJS.Timeout | null = null;
const geoInFlight = new Map<string, Promise<{ ok: true; lat: number; lon: number; city?: string; country?: string; ts: number; cached: boolean; meta?: GeoMeta }>>();
let settingsCache: { summonerBase?: string } | null = null;

type GeoMeta = {
  queued: boolean;
  queueDepth: number;
  waitedMs: number;
  rateLimitPerMin: number;
};

function isValidHost(host: string): boolean {
  // Allow IPv4, localhost, and basic DNS names.
  // Keep this strict for a secure baseline. Expand later if needed.
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const dns = /^[a-zA-Z0-9.-]+$/;
  if (host === "localhost") return true;
  if (ipv4.test(host)) {
    const parts = host.split(".").map((p) => Number(p));
    return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
  }
  return dns.test(host) && host.length <= 253;
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function safeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Unknown error";
}

function getDefaultSummonerBase(): string {
  if (process.platform === "win32") {
    const base =
      process.env.LOCALAPPDATA || process.env.APPDATA || path.join(os.homedir(), "AppData", "Local");
    return base;
  }
  return path.join(os.homedir(), ".local");
}

function getDefaultSummonerRoot(): string {
  return path.join(getDefaultSummonerBase(), "summoner");
}

function getSettingsPath(): string {
  return path.join(getDefaultSummonerRoot(), SETTINGS_FILE);
}

function normalizeSummonerBase(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const resolved = trimmed.startsWith("~")
    ? path.join(os.homedir(), trimmed.slice(1))
    : trimmed;
  if (!path.isAbsolute(resolved)) return null;
  return resolved;
}

function formatPathForDisplay(value: string): string {
  if (process.platform === "win32") return value;
  const home = os.homedir();
  if (value === home) return "~";
  if (value.startsWith(`${home}${path.sep}`)) return `~${value.slice(home.length)}`;
  return value;
}

function readSettingsSync(): { summonerBase?: string } {
  if (settingsCache) return settingsCache;
  try {
    const raw = readFileSync(getSettingsPath(), "utf-8");
    const parsed = JSON.parse(raw) as { summonerBase?: string; summonerRoot?: string };
    if (parsed && typeof parsed === "object") {
      if (!parsed.summonerBase && typeof parsed.summonerRoot === "string") {
        const maybeRoot = parsed.summonerRoot;
        const base = path.basename(maybeRoot) === "summoner" ? path.dirname(maybeRoot) : maybeRoot;
        settingsCache = { summonerBase: base };
      } else {
        settingsCache = { summonerBase: parsed.summonerBase };
      }
    } else {
      settingsCache = {};
    }
  } catch {
    settingsCache = {};
  }
  return settingsCache;
}

async function writeSettings(next: { summonerBase?: string }): Promise<void> {
  settingsCache = next;
  const filePath = getSettingsPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(next, null, 2) + "\n", "utf-8");
}

function getSummonerRoot(): string {
  const settings = readSettingsSync();
  const overrideBase = normalizeSummonerBase(settings.summonerBase);
  const base = overrideBase ?? getDefaultSummonerBase();
  return path.join(base, "summoner");
}

function getMapsRoot(): string {
  return path.join(getSummonerRoot(), "maps");
}

function getBundledMapsRoot(): string {
  if (isDev) {
    return path.join(process.cwd(), "assets", "summoner-geofit", "maps");
  }
  return path.join(process.resourcesPath, "maps");
}

async function ensureLocalMapsSeeded() {
  const bundledRoot = getBundledMapsRoot();
  const localRoot = getMapsRoot();
  await fs.mkdir(localRoot, { recursive: true });

  let entries: string[] = [];
  try {
    const dirents = await fs.readdir(bundledRoot, { withFileTypes: true });
    entries = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return;
  }

  await Promise.all(
    entries.map(async (name) => {
      const srcDir = path.join(bundledRoot, name);
      const destDir = path.join(localRoot, name);
      try {
        await fs.access(destDir);
        return;
      } catch {
        // Missing: copy bundled maps into local maps directory.
      }
      try {
        await fs.cp(srcDir, destDir, { recursive: true, errorOnExist: false });
      } catch {
        // Best effort; ignore copy failures.
      }
    })
  );
}

async function listMapsFromDir(dir: string, source: "bundle" | "local") {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const items = await Promise.all(
    entries.map(async (name) => {
      const mapDir = path.join(dir, name);
      try {
        const stat = await fs.stat(mapDir);
        if (!stat.isDirectory()) return null;
        const svgPath = path.join(mapDir, "map.svg");
        const paramsPath = path.join(mapDir, "mercator_params.json");
        await fs.access(svgPath);
        await fs.access(paramsPath);
        return {
          id: `${source}:${name}`,
          name,
          source,
          mapDir,
          svgPath,
          paramsPath
        };
      } catch {
        return null;
      }
    })
  );
  return items.filter(Boolean) as {
    id: string;
    name: string;
    source: "bundle" | "local";
    mapDir: string;
    svgPath: string;
    paramsPath: string;
  }[];
}

async function readMapsMeta(): Promise<{ selectedMapId?: string }> {
  const root = getMapsRoot();
  await fs.mkdir(root, { recursive: true });
  const metaPath = path.join(root, MAPS_META_FILE);
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    const parsed = JSON.parse(raw) as { selectedMapId?: string };
    return parsed ?? {};
  } catch {
    return {};
  }
}

async function writeMapsMeta(meta: { selectedMapId?: string }): Promise<void> {
  const root = getMapsRoot();
  await fs.mkdir(root, { recursive: true });
  const metaPath = path.join(root, MAPS_META_FILE);
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
}

function rateLimitOk(): boolean {
  const now = Date.now();
  while (geoRequests.length > 0 && now - geoRequests[0] > GEO_RATE_WINDOW_MS) {
    geoRequests.shift();
  }
  if (geoRequests.length >= GEO_RATE_LIMIT) return false;
  geoRequests.push(now);
  return true;
}

function extractIpv4(value: string): string | null {
  const match = value.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
  if (!match) return null;
  const parts = match[1].split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return match[1];
}

async function ensureGeoCacheLoaded(): Promise<void> {
  if (geoCacheLoaded) return;
  geoCacheLoaded = true;
  const root = getMapsRoot();
  await fs.mkdir(root, { recursive: true });
  const filePath = path.join(root, GEO_CACHE_FILE);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Record<
      string,
      { lat: number; lon: number; city?: string; country?: string; ts: number }
    >;
    Object.entries(parsed).forEach(([ip, info]) => {
      if (
        typeof ip === "string" &&
        info &&
        typeof info.lat === "number" &&
        typeof info.lon === "number" &&
        typeof info.ts === "number"
      ) {
        geoCache.set(ip, info);
      }
    });
  } catch {
    // ignore missing or invalid cache
  }
}

function scheduleGeoCacheWrite(): void {
  if (geoCacheWriteTimer) return;
  geoCacheWriteTimer = setTimeout(async () => {
    geoCacheWriteTimer = null;
    const root = getMapsRoot();
    await fs.mkdir(root, { recursive: true });
    const filePath = path.join(root, GEO_CACHE_FILE);
    const data: Record<string, { lat: number; lon: number; city?: string; country?: string; ts: number }> = {};
    geoCache.forEach((value, key) => {
      data[key] = value;
    });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  }, 500);
}

function enqueueGeoLookup<T>(fn: () => Promise<T>): Promise<T> {
  const next = geoQueue.then(fn, fn);
  geoQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function getServerLogsRoot(): string {
  return path.join(getSummonerRoot(), "servers");
}

function getServersStatePath(): string {
  return path.join(getServerLogsRoot(), SERVERS_STATE_FILE);
}

async function readServersState(): Promise<{ localServerPids?: Record<string, number> }> {
  const filePath = getServersStatePath();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as { localServerPids?: Record<string, number> };
    return data ?? {};
  } catch {
    return {};
  }
}

async function writeServersState(next: { localServerPids?: Record<string, number> }): Promise<void> {
  const filePath = getServersStatePath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(next, null, 2) + "\n", "utf-8");
}

function sanitizeLogId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function resolveServerLogId(args: { serverId: string; host?: string; port?: number }, map: Map<string, { host: string; port: number }>): string {
  if (args.host) return sanitizeLogId(args.port ? `${args.host}-${args.port}` : args.host);
  const fromMap = map.get(args.serverId);
  if (fromMap) return sanitizeLogId(`${fromMap.host}-${fromMap.port}`);
  return sanitizeLogId(args.serverId);
}

async function loadLogLines(logId: string): Promise<string[] | null> {
  const existing = logStore.get(logId);
  if (existing?.loaded) return existing.lines;
  const logDir = getServerLogsRoot();
  await fs.mkdir(logDir, { recursive: true });
  const filePath = path.join(logDir, `${logId}.jsonl`);
  let content = "";
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
  const lines = content.split(/\r?\n/).filter(Boolean).slice(-MAX_LOG_LINES);
  logStore.set(logId, { loaded: true, lines });
  return lines;
}

async function appendLogLine(logId: string, entry: ServerLogEntry): Promise<void> {
  const queue = logQueues.get(logId) ?? Promise.resolve();
  const next = queue.then(async () => {
    const lines = await loadLogLines(logId);
    if (!lines) {
      // If we cannot read existing logs, do not overwrite the file.
      return;
    }
    lines.push(JSON.stringify(entry));
    if (lines.length > MAX_LOG_LINES) lines.splice(0, lines.length - MAX_LOG_LINES);
    const logDir = getServerLogsRoot();
    await fs.mkdir(logDir, { recursive: true });
    const filePath = path.join(logDir, `${logId}.jsonl`);
    await fs.writeFile(filePath, lines.join("\n") + "\n", "utf-8");
  });
  logQueues.set(logId, next.catch(() => undefined));
  await next;
}

async function resolveProjectDirByName(name: string): Promise<string> {
  const root = getSummonerRoot();
  const direct = path.join(root, `summoner-sdk-${name}`);
  try {
    await fs.access(direct);
    return direct;
  } catch {
    // fall through
  }

  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    throw new Error("Summoner workspace not found");
  }
  const candidates = entries.filter((entry) => entry.startsWith("summoner-sdk-"));
  for (const entry of candidates) {
    const projectDir = path.join(root, entry);
    const metaPath = path.join(projectDir, PROJECT_META_FILE);
    try {
      const raw = await fs.readFile(metaPath, "utf-8");
      const meta = JSON.parse(raw) as { name?: string };
      if (meta.name === name) return projectDir;
    } catch {
      // ignore
    }
  }

  throw new Error("Project folder not found");
}

function normalizeProjectName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, "-");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(cleaned)) {
    throw new Error("Invalid project name. Use letters, numbers, ., _, and - only.");
  }
  return cleaned;
}

function normalizeAgentName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, "-").replace(/^agent_+/i, "");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(cleaned)) {
    throw new Error("Invalid agent name. Use letters, numbers, ., _, and - only.");
  }
  return cleaned;
}

async function writeLocalServerPid(projectName: string, pid: number): Promise<void> {
  const state = await readServersState();
  const next = { ...(state.localServerPids ?? {}), [projectName]: pid };
  await writeServersState({ ...state, localServerPids: next });
}

async function readLocalServerPid(projectName: string): Promise<number | null> {
  const state = await readServersState();
  const pid = state.localServerPids?.[projectName];
  if (!pid || !Number.isFinite(pid) || pid <= 0) return null;
  return pid;
}

async function clearLocalServerPid(projectName: string): Promise<void> {
  const state = await readServersState();
  if (!state.localServerPids?.[projectName]) return;
  const next = { ...(state.localServerPids ?? {}) };
  delete next[projectName];
  await writeServersState({ ...state, localServerPids: next });
}

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function terminatePid(pid: number): Promise<boolean> {
  try {
    process.kill(pid);
  } catch {
    return !isPidRunning(pid);
  }
  await sleep(250);
  if (!isPidRunning(pid)) return true;
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // ignore
  }
  await sleep(250);
  return !isPidRunning(pid);
}

async function listProjectDirs(): Promise<Array<{ name: string; dir: string }>> {
  const root = getSummonerRoot();
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    return [];
  }
  const candidates = entries.filter((name) => name.startsWith("summoner-sdk-"));
  const items = await Promise.all(
    candidates.map(async (entry) => {
      const projectDir = path.join(root, entry);
      const metaPath = path.join(projectDir, PROJECT_META_FILE);
      try {
        const raw = await fs.readFile(metaPath, "utf-8");
        const meta = JSON.parse(raw) as { name?: string };
        return { name: meta.name ?? entry.replace(/^summoner-sdk-/, ""), dir: projectDir };
      } catch {
        return { name: entry.replace(/^summoner-sdk-/, ""), dir: projectDir };
      }
    })
  );
  return items;
}

function buildTxtFromSelections(selections: Record<string, string[]>): string {
  const blocks: string[] = [];
  for (const [bundleId, modules] of Object.entries(selections)) {
    if (!Array.isArray(modules) || modules.length === 0) continue;
    const repo = BUNDLE_REPOS[bundleId];
    if (!repo) throw new Error(`Unknown bundle: ${bundleId}`);
    blocks.push(`${repo}:\n${modules.join("\n")}`);
  }
  return blocks.length ? blocks.join("\n\n") + "\n" : "";
}

function parseBuildTxt(text: string): Record<string, string[]> {
  const blocks = text
    .split(/\n{2,}/g)
    .map((b) => b.trim())
    .filter(Boolean);
  const out: Record<string, string[]> = {};
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const repoLine = lines[0].replace(/:$/, "");
    const bundleId = REPO_TO_BUNDLE[repoLine];
    if (!bundleId) continue;
    const modules = lines.slice(1);
    if (modules.length > 0) out[bundleId] = modules;
  }
  return out;
}

async function writeProjectMeta(
  projectDir: string,
  meta: {
    name: string;
    serverVersion: string;
    selections: Record<string, string[]>;
    createdAt: number;
    updatedAt: number;
  }
) {
  const metaPath = path.join(projectDir, PROJECT_META_FILE);
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf-8");
}

async function runCommand(cmd: string, args: string[], cwd: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function spawnWithFallback(
  candidates: { cmd: string; args: string[] }[],
  opts: { cwd: string }
): Promise<ReturnType<typeof spawn>> {
  let lastErr: unknown = null;
  for (const c of candidates) {
    const proc = spawn(c.cmd, c.args, { cwd: opts.cwd, stdio: "pipe" });
    try {
      await new Promise<void>((resolve, reject) => {
        proc.once("error", (e) => reject(e));
        proc.once("spawn", () => resolve());
      });
      return proc;
    } catch (e) {
      lastErr = e;
      if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw e;
    }
  }
  throw (lastErr instanceof Error ? lastErr : new Error("Failed to spawn process"));
}

async function resolvePythonCommand(projectDir: string): Promise<{ cmd: string; prefixArgs: string[] }> {
  const candidates: { cmd: string; prefixArgs: string[]; path: string }[] = [];
  if (process.platform === "win32") {
    candidates.push(
      { cmd: path.join(projectDir, ".venv", "Scripts", "python.exe"), prefixArgs: [], path: ".venv/Scripts/python.exe" },
      { cmd: path.join(projectDir, "venv", "Scripts", "python.exe"), prefixArgs: [], path: "venv/Scripts/python.exe" }
    );
  } else {
    candidates.push(
      { cmd: path.join(projectDir, ".venv", "bin", "python"), prefixArgs: [], path: ".venv/bin/python" },
      { cmd: path.join(projectDir, "venv", "bin", "python"), prefixArgs: [], path: "venv/bin/python" }
    );
  }

  for (const c of candidates) {
    try {
      await fs.access(c.cmd);
      return { cmd: c.cmd, prefixArgs: c.prefixArgs };
    } catch {
      // keep searching
    }
  }

  throw new Error("Project venv not found. Run setup to create the venv before starting agents.");
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const base = path.join(os.tmpdir(), `summoner-agent-${Date.now()}`);
  await fs.mkdir(base, { recursive: true });
  try {
    return await fn(base);
  } finally {
    await fs.rm(base, { recursive: true, force: true });
  }
}

async function runSetupOrReset(cwd: string, action: "setup" | "reset", serverVersion: string) {
  if (process.platform === "win32") {
    const cmd = "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; .\\build_sdk_on_windows.ps1 " + action;
    await runCommand("powershell.exe", ["-NoProfile", "-Command", cmd], cwd);
  } else {
    const cmd = `source build_sdk.sh ${action} --server ${serverVersion}`;
    await runCommand("bash", ["-lc", cmd], cwd);
  }
}

function parseGithubSource(input: string): { repoUrl: string; branch: string; subpath: string } {
  const raw = input.trim();
  if (!raw) throw new Error("GitHub source is required.");
  let user = "";
  let repo = "";
  let branch = "main";
  let subpath = "";

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    const url = new URL(raw);
    if (url.hostname !== "github.com") throw new Error("Only github.com URLs are supported.");
    const parts = url.pathname.replace(/^\/+/, "").split("/");
    user = parts[0] ?? "";
    repo = (parts[1] ?? "").replace(/\.git$/, "");
    if (parts[2] === "tree" || parts[2] === "blob") {
      branch = parts[3] ?? branch;
      subpath = parts.slice(4).join("/");
    } else if (parts.length > 2) {
      subpath = parts.slice(2).join("/");
    }
  } else {
    const parts = raw.replace(/^\/+/, "").split("/");
    user = parts[0] ?? "";
    repo = (parts[1] ?? "").replace(/\.git$/, "");
    if (parts.length > 2) subpath = parts.slice(2).join("/");
  }

  if (!user || !repo) {
    throw new Error("GitHub source must include user and repo.");
  }

  return {
    repoUrl: `https://github.com/${user}/${repo}.git`,
    branch,
    subpath
  };
}

function parseArgs(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    out.push(m[1] ?? m[2] ?? m[3]);
  }
  return out;
}

export function registerIpc(win: BrowserWindow, tcp: TcpManager) {
  const serverIndex = new Map<string, { host: string; port: number }>();
  // When the app is started twice (common on macOS activation edge cases),
  // Electron will throw if we register a second handler for the same channel.
  // Keep this idempotent for a stable, secure baseline.
  ipcMain.removeHandler("tcp:connect");
  ipcMain.removeHandler("tcp:reconnect");
  ipcMain.removeHandler("tcp:disconnect");
  ipcMain.removeHandler("tcp:sendChat");
  ipcMain.removeHandler("projects:create");
  ipcMain.removeHandler("projects:reset");
  ipcMain.removeHandler("projects:remove");
  ipcMain.removeHandler("projects:list");
  ipcMain.removeHandler("projects:envRead");
  ipcMain.removeHandler("projects:envWrite");
  ipcMain.removeHandler("logs:read");
  ipcMain.removeHandler("localServer:loadConfig");
  ipcMain.removeHandler("localServer:saveConfig");
  ipcMain.removeHandler("localServer:run");
  ipcMain.removeHandler("localServer:stop");
  ipcMain.removeHandler("localServer:listRunning");
  ipcMain.removeHandler("agents:import");
  ipcMain.removeHandler("agents:list");
  ipcMain.removeHandler("agents:start");
  ipcMain.removeHandler("agents:stop");
  ipcMain.removeHandler("agents:listRunning");
  ipcMain.removeHandler("agents:getIdentity");
  ipcMain.removeHandler("agents:remove");
  ipcMain.removeHandler("maps:list");
  ipcMain.removeHandler("maps:load");
  ipcMain.removeHandler("maps:select");
  ipcMain.removeHandler("maps:openFolder");
  ipcMain.removeHandler("maps:geoLookup");
  ipcMain.removeHandler("settings:get");
  ipcMain.removeHandler("settings:set");

  ipcMain.handle("tcp:connect", async (_e, args: { server: ServerProfile }) => {
    try {
      const s = args.server;
      if (!s || typeof s !== "object") throw new Error("Missing server");
      if (typeof s.id !== "string" || s.id.length < 1) throw new Error("Invalid server id");
      if (typeof s.host !== "string" || !isValidHost(s.host)) throw new Error("Invalid host");
      if (typeof s.port !== "number" || !isValidPort(s.port)) throw new Error("Invalid port");

      serverIndex.set(s.id, { host: s.host, port: s.port });
      tcp.connect(s.id, s.host, s.port);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("tcp:reconnect", async (_e, args: { serverId: string }) => {
    try {
      if (typeof args.serverId !== "string" || args.serverId.length < 1) throw new Error("Invalid server id");
      const entry = serverIndex.get(args.serverId);
      if (!entry) throw new Error("Unknown server id");
      tcp.disconnect(args.serverId);
      tcp.connect(args.serverId, entry.host, entry.port);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("tcp:disconnect", async (_e, args: { serverId: string }) => {
    try {
      if (typeof args.serverId !== "string" || args.serverId.length < 1) throw new Error("Invalid server id");
      tcp.disconnect(args.serverId);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("tcp:sendChat", async (_e, args: { serverId: string; text: string }) => {
    try {
      if (typeof args.serverId !== "string" || args.serverId.length < 1) throw new Error("Invalid server id");
      if (typeof args.text !== "string") throw new Error("Invalid text");
      if (args.text.length === 0) throw new Error("Empty message");
      if (args.text.length > 8000) throw new Error("Message too large");

      tcp.sendRaw(args.serverId, args.text);
      const logId = resolveServerLogId({ serverId: args.serverId }, serverIndex);
      void appendLogLine(logId, { ts: Date.now(), direction: "out", raw: args.text });

      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("settings:get", async () => {
    try {
      const settings = readSettingsSync();
      const defaultBase = getDefaultSummonerBase();
      const overrideBase = normalizeSummonerBase(settings.summonerBase);
      const effectiveBase = overrideBase ?? defaultBase;
      const effectiveRoot = path.join(effectiveBase, "summoner");
      return {
        ok: true as const,
        platform: process.platform,
        defaultSummonerBase: defaultBase,
        displayDefaultSummonerBase: formatPathForDisplay(defaultBase),
        summonerBase: overrideBase ?? null,
        effectiveSummonerBase: effectiveBase,
        displayEffectiveSummonerBase: formatPathForDisplay(effectiveBase),
        effectiveSummonerRoot: effectiveRoot,
        displayEffectiveSummonerRoot: formatPathForDisplay(effectiveRoot)
      };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("settings:set", async (_e, args: { summonerBase?: string | null }) => {
    try {
      const normalizedBase = normalizeSummonerBase(args?.summonerBase ?? null);
      if (args?.summonerBase && !normalizedBase) {
        throw new Error("Workspace base must be an absolute path");
      }
      if (normalizedBase) {
        await fs.mkdir(normalizedBase, { recursive: true });
        const stat = await fs.stat(normalizedBase);
        if (!stat.isDirectory()) {
          throw new Error("Workspace base must be a directory");
        }
        await fs.access(normalizedBase, fsConstants.W_OK);
        const workspaceRoot = path.join(normalizedBase, "summoner");
        await fs.mkdir(workspaceRoot, { recursive: true });
        await fs.access(workspaceRoot, fsConstants.W_OK);
      }
      await writeSettings({ summonerBase: normalizedBase ?? undefined });
      const defaultBase = getDefaultSummonerBase();
      const effectiveBase = normalizedBase ?? defaultBase;
      const effectiveRoot = path.join(effectiveBase, "summoner");
      return {
        ok: true as const,
        platform: process.platform,
        defaultSummonerBase: defaultBase,
        displayDefaultSummonerBase: formatPathForDisplay(defaultBase),
        summonerBase: normalizedBase ?? null,
        effectiveSummonerBase: effectiveBase,
        displayEffectiveSummonerBase: formatPathForDisplay(effectiveBase),
        effectiveSummonerRoot: effectiveRoot,
        displayEffectiveSummonerRoot: formatPathForDisplay(effectiveRoot)
      };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle(
    "projects:create",
    async (
      _e,
      args: { name: string; serverVersion: string; selections: Record<string, string[]> }
    ) => {
      try {
        if (!args || typeof args !== "object") throw new Error("Missing project data");
        const name = normalizeProjectName(args.name ?? "");
        const serverVersion = typeof args.serverVersion === "string" && args.serverVersion.length > 0
          ? args.serverVersion
          : "v1_1_0";
        const selections = args.selections ?? {};
        const buildTxt = buildTxtFromSelections(selections);
        if (!buildTxt) throw new Error("Select at least one module");

        const root = getSummonerRoot();
        await fs.mkdir(root, { recursive: true });
        const projectDir = path.join(root, `summoner-sdk-${name}`);

        try {
          await fs.access(projectDir);
          throw new Error("Project already exists");
        } catch {
          // OK: does not exist
        }

        await runCommand("git", ["clone", "https://github.com/Summoner-Network/summoner-sdk.git", projectDir], root);
        await fs.writeFile(path.join(projectDir, "build.txt"), buildTxt, "utf-8");
        const now = Date.now();
        await writeProjectMeta(projectDir, {
          name,
          serverVersion,
          selections,
          createdAt: now,
          updatedAt: now
        });
        await runSetupOrReset(projectDir, "setup", serverVersion);
        return { ok: true as const };
      } catch (e) {
        return { ok: false as const, error: safeError(e) };
      }
    }
  );

  ipcMain.handle("projects:reset", async (_e, args: { name: string; serverVersion: string }) => {
    try {
      const name = normalizeProjectName(args.name ?? "");
      const serverVersion = typeof args.serverVersion === "string" && args.serverVersion.length > 0
        ? args.serverVersion
        : "v1_1_0";
      const root = getSummonerRoot();
      const projectDir = path.join(root, `summoner-sdk-${name}`);
      await fs.access(projectDir);
      const metaPath = path.join(projectDir, PROJECT_META_FILE);
      try {
        const raw = await fs.readFile(metaPath, "utf-8");
        const parsed = JSON.parse(raw) as {
          name?: string;
          serverVersion?: string;
          selections?: Record<string, string[]>;
          createdAt?: number;
        };
        const now = Date.now();
        await writeProjectMeta(projectDir, {
          name,
          serverVersion,
          selections: parsed.selections ?? {},
          createdAt: parsed.createdAt ?? now,
          updatedAt: now
        });
      } catch {
        const now = Date.now();
        await writeProjectMeta(projectDir, {
          name,
          serverVersion,
          selections: {},
          createdAt: now,
          updatedAt: now
        });
      }
      await runSetupOrReset(projectDir, "reset", serverVersion);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("projects:remove", async (_e, args: { name: string }) => {
    try {
      const name = normalizeProjectName(args.name ?? "");
      const root = getSummonerRoot();
      const projectDir = path.join(root, `summoner-sdk-${name}`);
      await fs.rm(projectDir, { recursive: true, force: true });
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("projects:list", async () => {
    try {
      const root = getSummonerRoot();
      let entries: string[] = [];
      try {
        entries = await fs.readdir(root);
      } catch {
        return { ok: true as const, items: [] };
      }
      const items = await Promise.all(
        entries
          .filter((name) => name.startsWith("summoner-sdk-"))
          .map(async (name) => {
            const projectDir = path.join(root, name);
            const stat = await fs.stat(projectDir);
            const metaPath = path.join(projectDir, PROJECT_META_FILE);
            try {
              const raw = await fs.readFile(metaPath, "utf-8");
              const meta = JSON.parse(raw) as {
                name?: string;
                serverVersion?: string;
                selections?: Record<string, string[]>;
                createdAt?: number;
              };
              return {
                name: meta.name ?? name.replace(/^summoner-sdk-/, ""),
                serverVersion: meta.serverVersion ?? "v1_1_0",
                selections: meta.selections ?? {},
                createdAt: meta.createdAt ?? stat.mtimeMs
              };
            } catch {
              // Fallback for older projects without metadata.
              const buildPath = path.join(projectDir, "build.txt");
              let buildTxt = "";
              try {
                buildTxt = await fs.readFile(buildPath, "utf-8");
              } catch {
                buildTxt = "";
              }
              const selections = buildTxt ? parseBuildTxt(buildTxt) : {};
              return {
                name: name.replace(/^summoner-sdk-/, ""),
                serverVersion: "v1_1_0",
                selections,
                createdAt: stat.mtimeMs
              };
            }
          })
      );
      return { ok: true as const, items };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("projects:envRead", async (_e, args: { name: string }) => {
    try {
      const name = normalizeProjectName(args.name ?? "");
      const projectDir = await resolveProjectDirByName(name);
      const envPath = path.join(projectDir, ".env");
      let content = "";
      try {
        content = await fs.readFile(envPath, "utf-8");
      } catch {
        content = "";
      }
      return { ok: true as const, content };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle(
    "projects:envWrite",
    async (_e, args: { name: string; content: string }) => {
      try {
        const name = normalizeProjectName(args.name ?? "");
        const projectDir = await resolveProjectDirByName(name);
        const envPath = path.join(projectDir, ".env");
        await fs.writeFile(envPath, args.content ?? "", "utf-8");
        return { ok: true as const };
      } catch (e) {
        return { ok: false as const, error: safeError(e) };
      }
    }
  );

  ipcMain.handle(
    "logs:read",
    async (
      _e,
      args: { serverId: string; host?: string; port?: number; limit?: number; before?: number }
    ) => {
    try {
      const logId = resolveServerLogId(args, serverIndex);
      const lines = await loadLogLines(logId);
      if (!lines) return { ok: true as const, items: [], before: 0, hasMore: false };
      const limit = Math.max(1, Math.min(1000, Number.isFinite(args.limit) ? Number(args.limit) : 300));
      const end = Number.isFinite(args.before) ? Math.min(Number(args.before), lines.length) : lines.length;
      const start = Math.max(0, end - limit);
      const items: ServerLogEntry[] = [];
      for (const line of lines.slice(start, end)) {
        try {
          const parsed = JSON.parse(line) as ServerLogEntry;
          if (parsed && typeof parsed.ts === "number" && typeof parsed.raw === "string") {
            items.push(parsed);
          }
        } catch {
          // skip malformed lines
        }
      }
      return { ok: true as const, items, before: start, hasMore: start > 0 };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  }
  );

  ipcMain.handle("localServer:loadConfig", async (_e, args: { projectName: string }) => {
    try {
      const projectName = normalizeProjectName(args.projectName ?? "");
      const projectDir = await resolveProjectDirByName(projectName);
      const metaPath = path.join(projectDir, PROJECT_META_FILE);
      const meta = await readJsonFile<{ name?: string; serverVersion?: string }>(metaPath, {});
      const serverVersion = typeof meta.serverVersion === "string" ? meta.serverVersion : "";
      const forcedVersion = forceServerVersion(serverVersion);

      const defaultPath = path.join(projectDir, "summoner-sdk", "desktop_data", "default_config.json");
      const configPath = path.join(projectDir, "configs", "server_config.json");
      const tooltipsLongPath = path.join(projectDir, "summoner-sdk", "desktop_data", "tooltips_long.json");
      const tooltipsShortPath = path.join(projectDir, "summoner-sdk", "desktop_data", "tooltips_short.json");

      let configSource: "default" | "saved" = "default";
      let config = await readJsonFile<Record<string, unknown>>(defaultPath, {});
      try {
        await fs.access(configPath);
        config = await readJsonFile<Record<string, unknown>>(configPath, config);
        configSource = "saved";
      } catch {
        // default
      }

      config.version = forcedVersion;

      const tooltipsLong = await readJsonFile<Record<string, unknown>>(tooltipsLongPath, {});
      const tooltipsShort = await readJsonFile<Record<string, unknown>>(tooltipsShortPath, {});

      return {
        ok: true as const,
        serverVersion,
        forcedVersion,
        configSource,
        configPath: "configs/server_config.json",
        config,
        tooltipsLong,
        tooltipsShort
      };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle(
    "localServer:saveConfig",
    async (_e, args: { projectName: string; config: Record<string, unknown> }) => {
      try {
        const projectName = normalizeProjectName(args.projectName ?? "");
        const projectDir = await resolveProjectDirByName(projectName);
        const metaPath = path.join(projectDir, PROJECT_META_FILE);
        const meta = await readJsonFile<{ name?: string; serverVersion?: string }>(metaPath, {});
        const serverVersion = typeof meta.serverVersion === "string" ? meta.serverVersion : "";
        const forcedVersion = forceServerVersion(serverVersion);

      const configDir = path.join(projectDir, "configs");
      const configPath = path.join(configDir, "server_config.json");
        await fs.mkdir(configDir, { recursive: true });
        const next = { ...(args.config ?? {}) };
        (next as Record<string, unknown>).version = forcedVersion;
        await fs.writeFile(configPath, JSON.stringify(next, null, 2) + "\n", "utf-8");
        return { ok: true as const };
      } catch (e) {
        return { ok: false as const, error: safeError(e) };
      }
    }
  );

  ipcMain.handle("localServer:run", async (_e, args: { projectName: string }) => {
    try {
      const projectName = normalizeProjectName(args.projectName ?? "");
      if (runningLocalServers.has(projectName)) {
        return { ok: false as const, error: "Local server is already running for this project." };
      }
      const projectDir = await resolveProjectDirByName(projectName);
      const metaPath = path.join(projectDir, PROJECT_META_FILE);
      const meta = await readJsonFile<{ name?: string; serverVersion?: string }>(metaPath, {});
      const serverVersion = typeof meta.serverVersion === "string" ? meta.serverVersion : "";
      await ensureConfigFile(projectDir, serverVersion);
      await ensureServerPy(projectDir);

      const python = await resolvePythonCommand(projectDir);
      const proc = spawn(python.cmd, [...python.prefixArgs, "server.py"], { cwd: projectDir, stdio: "inherit" });
      runningLocalServers.set(projectName, proc);
      const persistPid = async () => {
        const pid = proc.pid;
        if (!pid || !Number.isFinite(pid)) return;
        runningLocalServerPids.set(projectName, pid);
        await writeLocalServerPid(projectName, pid);
      };
      void persistPid();
      proc.once("spawn", () => {
        void persistPid();
      });
      if (!win.isDestroyed()) win.webContents.send("evt:localServer-start", { projectName });
      proc.on("exit", () => {
        runningLocalServers.delete(projectName);
        runningLocalServerPids.delete(projectName);
        void clearLocalServerPid(projectName);
        if (!win.isDestroyed()) win.webContents.send("evt:localServer-exit", { projectName });
      });
      proc.on("error", () => {
        runningLocalServers.delete(projectName);
        runningLocalServerPids.delete(projectName);
        void clearLocalServerPid(projectName);
        if (!win.isDestroyed()) win.webContents.send("evt:localServer-exit", { projectName });
      });
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("localServer:stop", async (_e, args: { projectName: string }) => {
    try {
      const projectName = normalizeProjectName(args.projectName ?? "");
      const projectDir = await resolveProjectDirByName(projectName);
      const port = await readLocalServerPort(projectDir);
      const proc = runningLocalServers.get(projectName);
      if (proc) {
        proc.kill();
      }
      const pid = runningLocalServerPids.get(projectName) ?? (await readLocalServerPid(projectName));
      if (!pid || !isPidRunning(pid)) {
        const pids = await findListeningPids(port);
        if (pids.length === 0) {
          throw new Error("Local server is not running");
        }
        for (const p of pids) {
          await terminatePid(p);
        }
        const stillUp = await findListeningPids(port);
        if (stillUp.length > 0) throw new Error("Failed to stop local server");
        await clearLocalServerPid(projectName);
        runningLocalServerPids.delete(projectName);
        if (!win.isDestroyed()) win.webContents.send("evt:localServer-exit", { projectName });
        return { ok: true as const };
      }
      const killed = await terminatePid(pid);
      const stillListening = await findListeningPids(port);
      if (stillListening.length > 0) {
        for (const p of stillListening) {
          await terminatePid(p);
        }
      }
      const stillUp = await findListeningPids(port);
      if (stillUp.length > 0) throw new Error("Failed to stop local server");
      await clearLocalServerPid(projectName);
      runningLocalServerPids.delete(projectName);
      if (!win.isDestroyed()) win.webContents.send("evt:localServer-exit", { projectName });
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("localServer:listRunning", async () => {
    try {
      const items = new Set<string>(runningLocalServers.keys());
      const projects = await listProjectDirs();
      for (const project of projects) {
        const pid = await readLocalServerPid(project.name);
        if (!pid) continue;
        if (isPidRunning(pid)) {
          items.add(project.name);
          runningLocalServerPids.set(project.name, pid);
        } else {
          await clearLocalServerPid(project.name);
          runningLocalServerPids.delete(project.name);
        }
      }
      for (const project of projects) {
        if (items.has(project.name)) continue;
        try {
          const port = await readLocalServerPort(project.dir);
          const pids = await findListeningPids(port);
          if (pids.length > 0) {
            items.add(project.name);
            runningLocalServerPids.set(project.name, pids[0]);
            await writeLocalServerPid(project.name, pids[0]);
          }
        } catch {
          // ignore probe failures
        }
      }
      return { ok: true as const, items: Array.from(items) };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle(
    "agents:import",
    async (_e, args: { projectName: string; source: string; name?: string }) => {
      try {
        if (!args || typeof args !== "object") throw new Error("Missing import data");
        const projectName = normalizeProjectName(args.projectName ?? "");
        const { repoUrl, branch, subpath } = parseGithubSource(args.source ?? "");
        const root = getSummonerRoot();
        const projectDir = path.join(root, `summoner-sdk-${projectName}`);
        await fs.access(projectDir);
        const agentsDir = path.join(projectDir, "agents");
        await fs.mkdir(agentsDir, { recursive: true });

        const derivedName = subpath
          ? subpath.split("/").filter(Boolean).pop() ?? "agent"
          : repoUrl.split("/").pop()?.replace(/\.git$/, "") ?? "agent";
        const displayName = normalizeAgentName(args.name?.trim() || derivedName);
        const folderName = `${AGENT_PREFIX}${displayName}`;
        const destDir = path.join(agentsDir, folderName);

        try {
          await fs.access(destDir);
          throw new Error("Agent already exists");
        } catch {
          // OK: does not exist
        }

        if (subpath) {
          await withTempDir(async (tmpDir) => {
            await runCommand("git", ["clone", "--filter=blob:none", "--sparse", "--branch", branch, repoUrl, tmpDir], root);
            await runCommand("git", ["-C", tmpDir, "sparse-checkout", "set", subpath], root);
            const sourceDir = path.join(tmpDir, subpath);
            await fs.cp(sourceDir, destDir, { recursive: true });
          });
        } else {
          await runCommand("git", ["clone", "--branch", branch, repoUrl, destDir], root);
        }

        return { ok: true as const };
      } catch (e) {
        return { ok: false as const, error: safeError(e) };
      }
    }
  );

  ipcMain.handle(
    "agents:start",
    async (_e, args: { projectName: string; agentName: string; options?: string }) => {
      try {
        const projectName = normalizeProjectName(args.projectName ?? "");
        const displayName = normalizeAgentName(args.agentName ?? "");
        const root = getSummonerRoot();
        const projectDir = path.join(root, `summoner-sdk-${projectName}`);
        await fs.access(projectDir);
        const agentsRoot = path.join(projectDir, "agents");
        const preferredFolder = `${AGENT_PREFIX}${displayName}`;
        let folderName = preferredFolder;
        let agentDir = path.join(agentsRoot, folderName);
        try {
          await fs.access(agentDir);
        } catch {
          folderName = displayName;
          agentDir = path.join(agentsRoot, folderName);
          await fs.access(agentDir);
        }
        const key = `${projectName}:${folderName}`;
        if (runningAgents.has(key)) throw new Error("Agent already running");

        const scriptPath = path.join("agents", folderName, "agent.py");
        const requirementsPath = path.join("agents", folderName, "requirements.txt");
        const userArgs = parseArgs(args.options ?? "");
        const python = await resolvePythonCommand(projectDir);
        try {
          await fs.access(path.join(projectDir, requirementsPath));
          await runCommand(python.cmd, [...python.prefixArgs, "-m", "pip", "install", "-r", requirementsPath], projectDir);
        } catch {
          // No requirements.txt or pip install failed (will surface on run)
        }
        const candidates = [
          { cmd: python.cmd, args: [...python.prefixArgs, scriptPath, ...userArgs] },
          { cmd: "python3", args: [scriptPath, ...userArgs] },
          { cmd: "python", args: [scriptPath, ...userArgs] }
        ];
        const proc = await spawnWithFallback(candidates, { cwd: projectDir });
        const startedAt = Date.now();
        runningAgents.set(key, {
          projectName,
          displayName,
          folderName,
          path: agentDir,
          startedAt,
          proc
        });

        proc.on("exit", () => {
          runningAgents.delete(key);
          const payload = { projectName, name: displayName, folderName };
          if (!win.isDestroyed()) win.webContents.send("evt:agent-exit", payload);
        });

        return { ok: true as const };
      } catch (e) {
        return { ok: false as const, error: safeError(e) };
      }
    }
  );

  ipcMain.handle("agents:stop", async (_e, args: { projectName: string; agentName: string }) => {
    try {
      const projectName = normalizeProjectName(args.projectName ?? "");
      const displayName = normalizeAgentName(args.agentName ?? "");
      const preferredFolder = `${AGENT_PREFIX}${displayName}`;
      const keyPreferred = `${projectName}:${preferredFolder}`;
      const keyFallback = `${projectName}:${displayName}`;
      const key = runningAgents.has(keyPreferred) ? keyPreferred : keyFallback;
      const running = runningAgents.get(key);
      if (!running) throw new Error("Agent is not running");
      running.proc.kill();
      runningAgents.delete(key);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("agents:remove", async (_e, args: { projectName: string; agentName: string; folderName?: string }) => {
    try {
      const projectName = normalizeProjectName(args.projectName ?? "");
      const displayName = normalizeAgentName(args.agentName ?? "");
      const preferredFolder = args.folderName?.trim() || `${AGENT_PREFIX}${displayName}`;
      const keyPreferred = `${projectName}:${preferredFolder}`;
      if (runningAgents.has(keyPreferred)) {
        throw new Error("Stop the agent before deleting it.");
      }
      const root = getSummonerRoot();
      const projectDir = path.join(root, `summoner-sdk-${projectName}`);
      const agentsRoot = path.join(projectDir, "agents");
      const preferredPath = path.join(agentsRoot, preferredFolder);
      try {
        await fs.rm(preferredPath, { recursive: true, force: true });
        return { ok: true as const };
      } catch {
        const fallbackPath = path.join(agentsRoot, displayName);
        await fs.rm(fallbackPath, { recursive: true, force: true });
        return { ok: true as const };
      }
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("agents:listRunning", async () => {
    try {
      const items = Array.from(runningAgents.values()).map((r) => ({
        projectName: r.projectName,
        name: r.displayName,
        folderName: r.folderName,
        path: r.path,
        startedAt: r.startedAt
      }));
      return { ok: true as const, items };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("agents:getIdentity", async (_e, args: { projectName: string; agentName: string }) => {
    try {
      const projectName = normalizeProjectName(args.projectName ?? "");
      const displayName = normalizeAgentName(args.agentName ?? "");
      const root = getSummonerRoot();
      const projectDir = path.join(root, `summoner-sdk-${projectName}`);
      const agentsRoot = path.join(projectDir, "agents");
      const preferredFolder = `${AGENT_PREFIX}${displayName}`;
      let folderName = preferredFolder;
      let agentDir = path.join(agentsRoot, folderName);
      try {
        await fs.access(agentDir);
      } catch {
        folderName = displayName;
        agentDir = path.join(agentsRoot, folderName);
      }
      const idPath = path.join(agentDir, "id.json");
      try {
        const raw = await fs.readFile(idPath, "utf-8");
        const parsed = JSON.parse(raw) as unknown;
        return { ok: true as const, value: parsed };
      } catch {
        return { ok: true as const, value: displayName };
      }
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("agents:list", async (_e, args: { projectName: string }) => {
    try {
      const projectName = normalizeProjectName(args.projectName ?? "");
      const root = getSummonerRoot();
      const projectDir = path.join(root, `summoner-sdk-${projectName}`);
      await fs.access(projectDir);
      const agentsDir = path.join(projectDir, "agents");
      let entries: string[] = [];
      try {
        entries = await fs.readdir(agentsDir);
      } catch {
        return { ok: true as const, items: [] };
      }
      const items = await Promise.all(
        entries.map(async (name) => {
          const full = path.join(agentsDir, name);
          const stat = await fs.stat(full);
          const display = name.startsWith(AGENT_PREFIX) ? name.slice(AGENT_PREFIX.length) : name;
          return { name: display, folderName: name, path: full, createdAt: stat.mtimeMs };
        })
      );
      return { ok: true as const, items };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("maps:list", async () => {
    try {
      const localRoot = getMapsRoot();
      await ensureLocalMapsSeeded();
      await fs.mkdir(localRoot, { recursive: true });
      const items = await listMapsFromDir(localRoot, "local");
      const meta = await readMapsMeta();
      let selectedMapId = meta.selectedMapId;
      if (!selectedMapId || !items.find((m) => m.id === selectedMapId)) {
        const defaultId = items.find((m) => m.id === "local:world_map_1")?.id ?? items[0]?.id;
        selectedMapId = defaultId;
        await writeMapsMeta({ selectedMapId });
      }
      return {
        ok: true as const,
        items: items.map((m) => ({ id: m.id, name: m.name, source: m.source })),
        selectedMapId
      };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("maps:load", async (_e, args: { id: string }) => {
    try {
      const localRoot = getMapsRoot();
      await ensureLocalMapsSeeded();
      const items = await listMapsFromDir(localRoot, "local");
      const item = items.find((m) => m.id === args.id);
      if (!item) throw new Error("Map not found");
      const [svg, params] = await Promise.all([
        fs.readFile(item.svgPath, "utf-8"),
        fs.readFile(item.paramsPath, "utf-8")
      ]);
      return { ok: true as const, svg, params };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("maps:select", async (_e, args: { id: string }) => {
    try {
      if (!args.id || typeof args.id !== "string") throw new Error("Invalid map id");
      await writeMapsMeta({ selectedMapId: args.id });
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("maps:openFolder", async () => {
    try {
      const root = getMapsRoot();
      await fs.mkdir(root, { recursive: true });
      const res = await shell.openPath(root);
      if (res) throw new Error(res);
      return { ok: true as const, path: root };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("maps:geoLookup", async (_e, args: { ip: string }) => {
    try {
      const raw = typeof args.ip === "string" ? args.ip.trim() : "";
      const ip = raw ? extractIpv4(raw) ?? "" : "";
      if (!ip) throw new Error("Missing IP");
      await ensureGeoCacheLoaded();
      const cached = geoCache.get(ip);
      if (cached && Date.now() - cached.ts < 24 * 60 * 60 * 1000) {
        return {
          ok: true as const,
          ...cached,
          cached: true,
          meta: { queued: false, queueDepth: 0, waitedMs: 0, rateLimitPerMin: GEO_RATE_LIMIT }
        };
      }
      const inFlight = geoInFlight.get(ip);
      if (inFlight) {
        return await inFlight;
      }

      const queuedAt = Date.now();
      const promise = enqueueGeoLookup(async () => {
        await ensureGeoCacheLoaded();
        const cachedAgain = geoCache.get(ip);
        if (cachedAgain && Date.now() - cachedAgain.ts < 24 * 60 * 60 * 1000) {
          return {
            ok: true as const,
            ...cachedAgain,
            cached: true,
            meta: {
              queued: true,
              queueDepth: geoInFlight.size,
              waitedMs: Date.now() - queuedAt,
              rateLimitPerMin: GEO_RATE_LIMIT
            }
          };
        }
        let waitedMs = 0;
        while (!rateLimitOk()) {
          const now = Date.now();
          const waitMs = Math.max(200, GEO_RATE_WINDOW_MS - (now - (geoRequests[0] ?? now)));
          waitedMs += waitMs;
          await new Promise((r) => setTimeout(r, waitMs));
        }
        const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,city,lat,lon,query`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`IP lookup failed: ${res.status}`);
        const data = (await res.json()) as {
          status: string;
          message?: string;
          country?: string;
          city?: string;
          lat?: number;
          lon?: number;
        };
        if (data.status !== "success" || typeof data.lat !== "number" || typeof data.lon !== "number") {
          throw new Error(data.message || "Invalid IP lookup result");
        }
        const payload = {
          lat: data.lat,
          lon: data.lon,
          city: data.city,
          country: data.country,
          ts: Date.now()
        };
        geoCache.set(ip, payload);
        scheduleGeoCacheWrite();
        return {
          ok: true as const,
          ...payload,
          cached: false,
          meta: {
            queued: true,
            queueDepth: geoInFlight.size,
            waitedMs,
            rateLimitPerMin: GEO_RATE_LIMIT
          }
        };
      });

      geoInFlight.set(ip, promise);
      try {
        return await promise;
      } finally {
        geoInFlight.delete(ip);
      }
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  const safeSend = (channel: string, payload: unknown) => {
    if (win.isDestroyed()) return;
    const wc = win.webContents;
    if (wc.isDestroyed()) return;
    wc.send(channel, payload);
  };

  const onConnection = (state: unknown) => safeSend("evt:connection", state);
  const onMessage = (msg: unknown) => {
    if (msg && typeof msg === "object" && "serverId" in msg && "raw" in msg && "ts" in msg) {
      const m = msg as { serverId: string; raw: string; ts: number };
      const logId = resolveServerLogId({ serverId: m.serverId }, serverIndex);
      void appendLogLine(logId, { ts: m.ts, direction: "in", raw: m.raw });
    }
    safeSend("evt:message", msg);
  };

  tcp.on("connection", onConnection);
  tcp.on("message", onMessage);

  win.on("closed", () => {
    tcp.off("connection", onConnection);
    tcp.off("message", onMessage);
  });
}
type RunningAgent = {
  projectName: string;
  displayName: string;
  folderName: string;
  path: string;
  startedAt: number;
  proc: ReturnType<typeof spawn>;
};

const runningAgents = new Map<string, RunningAgent>();
const runningLocalServers = new Map<string, ReturnType<typeof spawn>>();
const runningLocalServerPids = new Map<string, number>();

function isVersionTag(value: string): boolean {
  return /^v\d+_\d+_\d+$/.test(value);
}

function forceServerVersion(serverVersion: string): string {
  if (isVersionTag(serverVersion)) {
    const clean = serverVersion.replace(/^v/, "v").replace(/_/g, ".");
    return `rust_${clean}`;
  }
  return "python";
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function pickPortFromConfig(config: Record<string, unknown>): number | null {
  const candidates = [
    config.port,
    (config.server as Record<string, unknown> | undefined)?.port,
    (config.network as Record<string, unknown> | undefined)?.port
  ];
  for (const value of candidates) {
    if (typeof value === "number" && isValidPort(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && isValidPort(parsed)) return parsed;
    }
  }
  return null;
}

async function readLocalServerPort(projectDir: string): Promise<number> {
  const configPath = path.join(projectDir, "configs", "server_config.json");
  const fallbackPath = path.join(projectDir, "summoner-sdk", "desktop_data", "default_config.json");
  const config = await readJsonFile<Record<string, unknown>>(configPath, {});
  const port = pickPortFromConfig(config);
  if (port) return port;
  const fallback = await readJsonFile<Record<string, unknown>>(fallbackPath, {});
  return pickPortFromConfig(fallback) ?? 8888;
}

async function execFileAsync(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding: "utf-8" }, (err, stdout, stderr) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ stdout: stdout ?? "", stderr: stderr ?? "" });
    });
  });
}

async function findListeningPids(port: number): Promise<number[]> {
  try {
    if (process.platform === "win32") {
      const netstatCmds = ["netstat", "C:\\Windows\\System32\\netstat.exe"];
      let stdout = "";
      let ok = false;
      for (const cmd of netstatCmds) {
        try {
          const res = await execFileAsync(cmd, ["-ano"]);
          stdout = res.stdout;
          ok = true;
          break;
        } catch {
          // try next
        }
      }
      if (!ok) return [];
      const pids = new Set<number>();
      stdout.split(/\r?\n/).forEach((line) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5) return;
        if (!parts[0].toUpperCase().startsWith("TCP")) return;
        const local = parts[1] ?? "";
        if (!local.endsWith(`:${port}`)) return;
        const state = parts[3] ?? "";
        if (state.toUpperCase() !== "LISTENING") return;
        const pid = Number(parts[4]);
        if (Number.isFinite(pid) && pid > 0) pids.add(pid);
      });
      return Array.from(pids);
    }
    const lsofCmds = ["lsof", "/usr/sbin/lsof", "/usr/bin/lsof"];
    let stdout = "";
    let ok = false;
    for (const cmd of lsofCmds) {
      try {
        const res = await execFileAsync(cmd, ["-tiTCP:" + String(port), "-sTCP:LISTEN"]);
        stdout = res.stdout;
        ok = true;
        break;
      } catch {
        // try next
      }
    }
    if (!ok) return [];
    const pids = stdout
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isFinite(pid) && pid > 0);
    return Array.from(new Set(pids));
  } catch {
    return [];
  }
}

async function ensureConfigFile(projectDir: string, serverVersion: string): Promise<{ configPath: string }> {
  const configDir = path.join(projectDir, "configs");
  const configPath = path.join(configDir, "server_config.json");
  try {
    await fs.access(configPath);
    return { configPath };
  } catch {
    // fall through
  }
  await fs.mkdir(configDir, { recursive: true });
  const defaultPath = path.join(projectDir, "summoner-sdk", "desktop_data", "default_config.json");
  const config = await readJsonFile<Record<string, unknown>>(defaultPath, {});
  config.version = forceServerVersion(serverVersion);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
  return { configPath };
}

async function ensureServerPy(projectDir: string): Promise<void> {
  const serverPyPath = path.join(projectDir, "server.py");
  try {
    await fs.access(serverPyPath);
    return;
  } catch {
    // fall through
  }
  const content = [
    "from summoner.server import SummonerServer",
    "",
    "if __name__ == \"__main__\":",
    "    srv = SummonerServer(name=\"DesktopServer\")",
    "    srv.run(config_path=\"configs/server_config.json\")",
    ""
  ].join("\n");
  await fs.writeFile(serverPyPath, content, "utf-8");
}
