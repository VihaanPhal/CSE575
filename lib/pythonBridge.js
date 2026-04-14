import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { ApiError } from "@/lib/api";

const execFileAsync = promisify(execFile);
const bridgeDir = join(process.cwd(), "cse575_sorting");
const bridgeScript = join(bridgeDir, "recommendation_bridge.py");
const benchmarkScript = join(bridgeDir, "test_recommenders.py");
const pythonExecutable = process.env.PYTHON_PATH || "python3";

export async function runRecommendationBridge(args, options = {}) {
  try {
    const { stdout } = await execFileAsync(pythonExecutable, [bridgeScript, ...args], {
      cwd: bridgeDir,
      timeout: options.timeout ?? 120_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return JSON.parse(stdout.trim() || "{}");
  } catch (error) {
    const stdout = error.stdout?.trim();
    if (stdout) {
      try {
        const payload = JSON.parse(stdout);
        throw new ApiError(502, payload.code || "BRIDGE_ERROR", payload.message || "Bridge failed.");
      } catch {
        // Fall through to generic bridge error.
      }
    }

    throw new ApiError(
      502,
      "BRIDGE_ERROR",
      "The Python recommendation bridge is unavailable.",
      { cause: error.message }
    );
  }
}

let benchmarkPromise = null;

export async function getBenchmarks(forceRefresh = false) {
  if (!forceRefresh && benchmarkPromise) {
    return benchmarkPromise;
  }

  benchmarkPromise = execFileAsync(
    pythonExecutable,
    [
      benchmarkScript,
      "--models",
      "simple,mf,wizan,ensemble",
      "--output",
      "/tmp/search-system-benchmarks.json",
    ],
    {
      cwd: bridgeDir,
      timeout: 180_000,
      maxBuffer: 8 * 1024 * 1024,
    }
  )
    .then(({ stdout }) => {
      const resultPath = "/tmp/search-system-benchmarks.json";
      return import("fs/promises").then(async ({ readFile }) => {
        const raw = await readFile(resultPath, "utf8");
        const metrics = JSON.parse(raw);
        const allRmse = Object.values(metrics).map((entry) => entry.RMSE);
        const suspicious =
          allRmse.length > 1 && allRmse.every((value) => value === allRmse[0]);

        return {
          metrics,
          suspicious,
          rawLog: stdout,
        };
      });
    })
    .catch((error) => {
      benchmarkPromise = null;
      throw new ApiError(
        502,
        "BENCHMARK_ERROR",
        "Failed to compute recommender benchmarks.",
        { cause: error.message }
      );
    });

  return benchmarkPromise;
}
