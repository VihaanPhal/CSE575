import { execFile } from "child_process";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const scriptPath = join(process.cwd(), "cse575_sorting", "matrix_factorization.py");
const ratingsPath = join(process.cwd(), "cse575_sorting", "ratings.csv");
const itemsPath = join(process.cwd(), "cse575_sorting", "movies.csv");

const CACHE_TTL_MS = 5 * 60 * 1000;
const recommendationCache = new Map();

function normalizePositiveInt(value, fallback, maxValue) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return fallback;
  }
  const bounded = Math.max(1, parsed);
  return maxValue ? Math.min(maxValue, bounded) : bounded;
}

function buildCacheKey({ userId, topN, method, nFactors, epochs }) {
  return `${userId}|${topN}|${method}|${nFactors}|${epochs}`;
}

async function runPython(scriptArgs) {
  const configuredCommands = process.env.PYTHON_BIN
    ? [process.env.PYTHON_BIN]
    : [];

  const windowsStoreCandidates = [];
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const windowsAppsDir = join(
      process.env.LOCALAPPDATA,
      "Microsoft",
      "WindowsApps"
    );

    for (const exeName of [
      "python3.13.exe",
      "python3.12.exe",
      "python3.11.exe",
      "python3.exe",
      "python.exe",
    ]) {
      windowsStoreCandidates.push(join(windowsAppsDir, exeName));
    }
  }

  const candidateCommands = [
    ...configuredCommands,
    ...windowsStoreCandidates,
    "python",
    "python3",
    "py",
  ];

  let lastError = null;

  for (const command of candidateCommands) {
    const args = command.toLowerCase() === "py"
      ? ["-3", scriptPath, ...scriptArgs]
      : [scriptPath, ...scriptArgs];

    try {
      return await execFileAsync(command, args, {
        cwd: process.cwd(),
        timeout: 180_000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (error) {
      lastError = error;
      if (error?.code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error("Python executable not found.");
}

function parsePythonJson(stdout, stderr) {
  const output = stdout?.trim();
  if (!output) {
    throw new Error(
      stderr?.trim() ||
        "Matrix factorization script returned no output."
    );
  }

  try {
    return JSON.parse(output);
  } catch {
    const stderrText = stderr?.trim();
    const errSuffix = stderrText ? ` Python stderr: ${stderrText}` : "";
    throw new Error(`Failed to parse matrix factorization JSON output.${errSuffix}`);
  }
}

export async function getMatrixRecommendations({
  userId,
  topN = 5,
  method = "svd",
  nFactors = 20,
  epochs = 20,
} = {}) {
  const normalizedUserId = normalizePositiveInt(userId, 1);
  const normalizedTopN = normalizePositiveInt(topN, 5, 50);
  const normalizedFactors = normalizePositiveInt(nFactors, 20, 200);
  const normalizedEpochs = normalizePositiveInt(epochs, 20, 500);
  const normalizedMethod = method === "gd" ? "gd" : "svd";

  const cacheKey = buildCacheKey({
    userId: normalizedUserId,
    topN: normalizedTopN,
    method: normalizedMethod,
    nFactors: normalizedFactors,
    epochs: normalizedEpochs,
  });

  const cached = recommendationCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.payload;
  }

  const scriptArgs = [
    "--ratings-csv",
    ratingsPath,
    "--items-csv",
    itemsPath,
    "--method",
    normalizedMethod,
    "--n-factors",
    String(normalizedFactors),
    "--epochs",
    String(normalizedEpochs),
    "--user-id",
    String(normalizedUserId),
    "--top-n",
    String(normalizedTopN),
    "--sample-users",
    "0",
    "--no-preview",
    "--quiet",
    "--json",
  ];

  const { stdout, stderr } = await runPython(scriptArgs);
  const payload = parsePythonJson(stdout, stderr);

  if (payload?.error) {
    throw new Error(String(payload.error));
  }

  const responsePayload = {
    userId: normalizedUserId,
    method: normalizedMethod,
    recommendations: Array.isArray(payload?.recommendations)
      ? payload.recommendations
      : [],
  };

  recommendationCache.set(cacheKey, {
    payload: responsePayload,
    createdAt: Date.now(),
  });

  return responsePayload;
}
