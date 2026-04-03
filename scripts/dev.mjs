#!/usr/bin/env node

import { spawn, spawnSync } from "child_process";
import { existsSync } from "fs";
import { basename, join } from "path";

const projectRoot = process.cwd();
const venvDir = join(projectRoot, ".venv");
const venvPython = process.platform === "win32"
  ? join(venvDir, "Scripts", "python.exe")
  : join(venvDir, "bin", "python");

function isPyLauncher(command) {
  const name = basename(command).toLowerCase();
  return name === "py" || name === "py.exe";
}

function runSync(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    ...options,
  });
}

function getPythonCandidates() {
  const candidates = [];

  if (process.env.PYTHON_BIN) {
    candidates.push(process.env.PYTHON_BIN);
  }

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
      candidates.push(join(windowsAppsDir, exeName));
    }
  }

  candidates.push("python", "python3", "py");

  return [...new Set(candidates)];
}

function findWorkingPython() {
  const probeCode = "import sys; print(sys.executable)";

  for (const candidate of getPythonCandidates()) {
    const probeArgs = isPyLauncher(candidate)
      ? ["-3", "-c", probeCode]
      : ["-c", probeCode];

    const result = runSync(candidate, probeArgs, { stdio: "pipe" });
    if (result.status === 0) {
      return candidate;
    }
  }

  return null;
}

function ensureVirtualEnv() {
  if (existsSync(venvPython)) {
    console.log("[dev] Reusing existing Python environment at .venv");
    return;
  }

  const pythonCommand = findWorkingPython();
  if (!pythonCommand) {
    throw new Error("No Python executable found to create .venv.");
  }

  console.log(`[dev] Creating Python virtual environment with ${pythonCommand}`);

  const createArgs = isPyLauncher(pythonCommand)
    ? ["-3", "-m", "venv", ".venv"]
    : ["-m", "venv", ".venv"];

  const createResult = runSync(pythonCommand, createArgs, { stdio: "inherit" });
  if (createResult.status !== 0 || !existsSync(venvPython)) {
    throw new Error("Failed to create .venv.");
  }
}

function ensurePythonPackages() {
  const checkResult = runSync(
    venvPython,
    ["-c", "import numpy, pandas"],
    { stdio: "pipe" }
  );

  if (checkResult.status === 0) {
    console.log("[dev] Python dependencies already installed (numpy, pandas)");
    return;
  }

  console.log("[dev] Installing Python dependencies: numpy, pandas");

  const pipUpgrade = runSync(
    venvPython,
    ["-m", "pip", "install", "--upgrade", "pip"],
    { stdio: "inherit" }
  );
  if (pipUpgrade.status !== 0) {
    throw new Error("Failed to upgrade pip in .venv.");
  }

  const pipInstall = runSync(
    venvPython,
    ["-m", "pip", "install", "numpy", "pandas"],
    { stdio: "inherit" }
  );
  if (pipInstall.status !== 0) {
    throw new Error("Failed to install numpy/pandas in .venv.");
  }
}

function startNextDev() {
  const nextCli = join(projectRoot, "node_modules", "next", "dist", "bin", "next");
  console.log("[dev] Starting Next.js dev server with PYTHON_BIN from .venv");

  const child = spawn(process.execPath, [nextCli, "dev"], {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      PYTHON_BIN: venvPython,
    },
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

function main() {
  ensureVirtualEnv();
  ensurePythonPackages();
  startNextDev();
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[dev] ${message}`);
  process.exit(1);
}
