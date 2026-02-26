/**
 * PriceLabs MCP Bridge Plugin for OpenClaw
 *
 * Bridges all 28 PriceLabs MCP server tools into OpenClaw agent tools.
 * Spawns the MCP server as a child process and communicates via stdio JSON-RPC.
 *
 * Generated from MCP server tool definitions.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Types matching OpenClaw plugin SDK
interface PluginApi {
  registerTool(tool: any, opts?: { optional?: boolean }): void;
  registerService?(svc: { id: string; start: () => void; stop: () => void }): void;
  config?: any;
  logger?: { info: (...args: any[]) => void; error: (...args: any[]) => void; warn: (...args: any[]) => void };
}

interface McpToolDef {
  name: string;
  description: string;
  inputSchema: any;
}

// MCP server child process state
let mcpProcess: ChildProcess | null = null;
let messageId = 0;
let initialized = false;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();

function getConfig(api: PluginApi) {
  const entries = api.config?.plugins?.entries?.pricelabs?.config || {};
  return {
    serverPath: entries.serverPath || resolve("/mnt/c/Projects/pricelabs-agent/mcp-servers/pricelabs/dist/index.js"),
    apiKey: entries.apiKey || process.env.PRICELABS_API_KEY || "",
    dbPath: entries.dbPath || "/home/NGA/.pricelabs-agent/data.sqlite",
    baseUrl: entries.baseUrl || "https://api.pricelabs.co",
    writesEnabled: entries.writesEnabled || "false",
  };
}

function ensureServer(cfg: ReturnType<typeof getConfig>, logger?: any): ChildProcess {
  if (mcpProcess && !mcpProcess.killed) return mcpProcess;

  logger?.info?.("[pricelabs] Spawning MCP server:", cfg.serverPath);

  mcpProcess = spawn("node", [cfg.serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      PRICELABS_API_KEY: cfg.apiKey,
      PRICELABS_DB_PATH: cfg.dbPath,
      PRICELABS_BASE_URL: cfg.baseUrl,
      PRICELABS_WRITES_ENABLED: cfg.writesEnabled,
    },
  });

  let buf = "";
  mcpProcess.stdout!.on("data", (data: Buffer) => {
    buf += data.toString();
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.substring(0, idx);
      buf = buf.substring(idx + 1);
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id != null && pending.has(msg.id)) {
          const p = pending.get(msg.id)!;
          pending.delete(msg.id);
          clearTimeout(p.timer);
          if (msg.error) {
            p.reject(new Error(msg.error.message || "MCP error"));
          } else {
            p.resolve(msg.result);
          }
        }
      } catch {
        // ignore non-JSON lines
      }
    }
  });

  mcpProcess.stderr!.on("data", () => {}); // suppress

  mcpProcess.on("exit", (code) => {
    logger?.warn?.("[pricelabs] MCP server exited with code", code);
    mcpProcess = null;
    initialized = false;
    // Reject all pending
    for (const [id, p] of pending) {
      clearTimeout(p.timer);
      p.reject(new Error("MCP server exited"));
    }
    pending.clear();
  });

  initialized = false;
  return mcpProcess;
}

function sendRpc(method: string, params: any = {}, timeoutMs = 30000): Promise<any> {
  const id = ++messageId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`MCP call timed out: ${method} (id=${id})`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    mcpProcess!.stdin!.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

async function initializeMcp(cfg: ReturnType<typeof getConfig>, logger?: any): Promise<void> {
  if (initialized) return;
  ensureServer(cfg, logger);

  await sendRpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "openclaw-pricelabs", version: "1.0.0" },
  });

  // Send initialized notification (no id = notification)
  mcpProcess!.stdin!.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
  initialized = true;
  logger?.info?.("[pricelabs] MCP server initialized");
}

async function callTool(name: string, args: any, cfg: ReturnType<typeof getConfig>, logger?: any): Promise<any> {
  await initializeMcp(cfg, logger);

  const result = await sendRpc("tools/call", { name, arguments: args }, 60000);
  return result;
}

// Load tool definitions from the bundled JSON
function loadToolDefs(): McpToolDef[] {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(resolve(__dirname, "tool-definitions.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    // Fallback: try relative to process.cwd
    try {
      const raw = readFileSync(resolve(process.cwd(), "openclaw/extensions/pricelabs/tool-definitions.json"), "utf-8");
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}

export default function register(api: PluginApi) {
  const cfg = getConfig(api);
  const logger = api.logger;
  const toolDefs = loadToolDefs();

  if (toolDefs.length === 0) {
    logger?.error?.("[pricelabs] No tool definitions found! Plugin will not register any tools.");
    return;
  }

  logger?.info?.(`[pricelabs] Registering ${toolDefs.length} tools from MCP server definitions`);

  for (const tool of toolDefs) {
    api.registerTool(
      {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
        async execute(_id: string, params: any) {
          try {
            const result = await callTool(tool.name, params, cfg, logger);
            return result;
          } catch (err: any) {
            return {
              content: [{ type: "text", text: `Error calling ${tool.name}: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { optional: false },
    );
  }

  // Register cleanup service
  if (api.registerService) {
    api.registerService({
      id: "pricelabs-mcp",
      start: () => {
        logger?.info?.("[pricelabs] MCP bridge service started (lazy init)");
      },
      stop: () => {
        if (mcpProcess && !mcpProcess.killed) {
          logger?.info?.("[pricelabs] Stopping MCP server");
          mcpProcess.kill();
          mcpProcess = null;
        }
      },
    });
  }
}
