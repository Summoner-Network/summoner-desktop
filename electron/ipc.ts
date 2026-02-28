import { ipcMain, BrowserWindow } from "electron";
import type { ServerProfile } from "./preload";
import { TcpManager } from "./tcp/TcpManager";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";

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

type ServerLogEntry = { ts: number; direction: "in" | "out"; raw: string };
const logStore = new Map<string, { loaded: boolean; lines: string[] }>();
const logQueues = new Map<string, Promise<void>>();

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

function getSummonerRoot(): string {
  if (process.platform === "win32") {
    const base =
      process.env.LOCALAPPDATA || process.env.APPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(base, "summoner");
  }
  return path.join(os.homedir(), ".local", "summoner");
}

function getServerLogsRoot(): string {
  return path.join(getSummonerRoot(), "server_logs");
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

async function loadLogLines(logId: string): Promise<string[]> {
  const existing = logStore.get(logId);
  if (existing?.loaded) return existing.lines;
  const logDir = getServerLogsRoot();
  await fs.mkdir(logDir, { recursive: true });
  const filePath = path.join(logDir, `${logId}.jsonl`);
  let content = "";
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch {
    content = "";
  }
  const lines = content.split(/\r?\n/).filter(Boolean).slice(-MAX_LOG_LINES);
  logStore.set(logId, { loaded: true, lines });
  return lines;
}

async function appendLogLine(logId: string, entry: ServerLogEntry): Promise<void> {
  const queue = logQueues.get(logId) ?? Promise.resolve();
  const next = queue.then(async () => {
    const lines = await loadLogLines(logId);
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
      if (!win.isDestroyed()) win.webContents.send("evt:localServer-start", { projectName });
      proc.on("exit", () => {
        runningLocalServers.delete(projectName);
        if (!win.isDestroyed()) win.webContents.send("evt:localServer-exit", { projectName });
      });
      proc.on("error", () => {
        runningLocalServers.delete(projectName);
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
      const proc = runningLocalServers.get(projectName);
      if (!proc) throw new Error("Local server is not running");
      proc.kill();
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: safeError(e) };
    }
  });

  ipcMain.handle("localServer:listRunning", async () => {
    try {
      return { ok: true as const, items: Array.from(runningLocalServers.keys()) };
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
