import { execFile } from "child_process";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const scriptPath = join(process.cwd(), "cse575_sorting", "wizan_api.py");

// Cache: key -> { payload, createdAt }
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

async function runWizan(args) {
  const candidates =
    process.platform === "win32" && process.env.LOCALAPPDATA
      ? [
          join(process.env.LOCALAPPDATA, "Microsoft", "WindowsApps", "python3.13.exe"),
          join(process.env.LOCALAPPDATA, "Microsoft", "WindowsApps", "python3.12.exe"),
          join(process.env.LOCALAPPDATA, "Microsoft", "WindowsApps", "python.exe"),
          "python",
          "python3",
        ]
      : ["python3", "python"];

  if (process.env.PYTHON_BIN) candidates.unshift(process.env.PYTHON_BIN);

  let lastErr = null;
  for (const cmd of candidates) {
    try {
      return await execFileAsync(cmd, [scriptPath, ...args], {
        cwd: process.cwd(),
        timeout: 300_000,        // 5 min — first run trains the model
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (e) {
      lastErr = e;
      if (e?.code === "ENOENT") continue;
      throw e;
    }
  }
  throw lastErr ?? new Error("Python executable not found.");
}

function parseJson(stdout, stderr) {
  const out = stdout?.trim();
  if (!out) throw new Error(stderr?.trim() || "wizan_api.py returned no output.");
  try {
    return JSON.parse(out);
  } catch {
    throw new Error(`Failed to parse wizan_api.py output. stderr: ${stderr?.trim()}`);
  }
}

// ── Public helpers ──────────────────────────────────────────────

export async function getWizanRecommendations({ userId, topN = 10 }) {
  const key = `existing:${userId}:${topN}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.createdAt < CACHE_TTL_MS) return hit.payload;

  const { stdout, stderr } = await runWizan([
    "--mode", "existing",
    "--user-id", String(userId),
    "--top-n",  String(topN),
  ]);
  const payload = parseJson(stdout, stderr);
  if (payload?.error) throw new Error(payload.error);

  cache.set(key, { payload, createdAt: Date.now() });
  return payload;
}

export async function getInterviewMovies({ count = 10 } = {}) {
  const key = `interview:${count}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.createdAt < CACHE_TTL_MS) return hit.payload;

  const { stdout, stderr } = await runWizan([
    "--mode",  "interview",
    "--count", String(count),
  ]);
  const payload = parseJson(stdout, stderr);
  if (payload?.error) throw new Error(payload.error);

  cache.set(key, { payload, createdAt: Date.now() });
  return payload;
}

export async function getColdStartRecommendations({ ratings, topN = 10 }) {
  // ratings: { [movieId]: starRating }
  const { stdout, stderr } = await runWizan([
    "--mode",    "coldstart",
    "--ratings", JSON.stringify(ratings),
    "--top-n",   String(topN),
  ]);
  const payload = parseJson(stdout, stderr);
  if (payload?.error) throw new Error(payload.error);
  return payload;
}
