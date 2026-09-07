import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ToolRunner } from "../runner.js";
import { generateSbyFile, parseFailedAssertions, parseSbyVerdict, logTail } from "../parsers/sby.js";
import { FormalProveResult } from "../parsers/types.js";

export interface ProveOptions {
  verilogSources: string[];
  topModule: string;
  mode?: "bmc" | "prove";
  depth?: number;
  defines?: string[];
  engine?: "smtbmc_z3";
  keepWorkdir?: boolean;
  cwd?: string;
  timeoutMs?: number;
}

const TOP_RE = /^[A-Za-z_][A-Za-z0-9_$]*$/;

/**
 * Runs a SymbiYosys BMC/prove task (smtbmc+z3) over assertions embedded in
 * the RTL and reports PROVEN / FAILED (with counterexample asserts) /
 * UNKNOWN / ERROR / TIMEOUT. Pair with `rtl_generate_assertion`
 * (mcp-rtl-review) to author the properties first.
 */
export async function runFormalProve(
  runner: ToolRunner,
  options: ProveOptions
): Promise<FormalProveResult> {
  const mode = options.mode ?? "bmc";
  const depth = options.depth ?? 10;
  const fail = (errors: string[]): FormalProveResult => ({
    success: false, verdict: "ERROR", topModule: options.topModule, mode, depth,
    engine: "smtbmc_z3", failedAssertions: [], warnings: [], errors, logTail: [],
  });

  if (options.verilogSources.length === 0) return fail(["No Verilog sources specified."]);
  if (!TOP_RE.test(options.topModule)) return fail([`Invalid top module name: "${options.topModule}".`]);
  if (!Number.isInteger(depth) || depth < 1 || depth > 100) {
    return fail(["depth must be an integer in [1, 100] (deeper bounds cost solver time)."]);
  }
  if (options.engine && options.engine !== "smtbmc_z3") {
    return fail([`Unsupported engine "${options.engine}". Supported: smtbmc_z3.`]);
  }

  const base = path.resolve(options.cwd || process.cwd());
  const workdir = `sby_work_${options.topModule}_${Date.now()}`;
  const workPath = path.join(base, workdir);
  const taskFile = `formal_tmp_${Date.now()}.sby`;
  const taskPath = path.join(base, taskFile);

  try {
    await fs.mkdir(workPath, { recursive: true });
    await fs.writeFile(
      taskPath,
      generateSbyFile({
        taskName: "check",
        mode,
        depth,
        engineLine: "smtbmc z3",
        topModule: options.topModule,
        sources: options.verilogSources,
        defines: options.defines ?? [],
        workSubdir: "run",
      }),
      "utf-8"
    );

    const res = await runner.execute("sby", ["-f", taskFile], {
      cwd: base,
      timeoutMs: options.timeoutMs ?? 300000,
    });
    const log = `${res.stdout}\n${res.stderr}`;
    const { verdict, errors } = parseSbyVerdict(res.exitCode, res.timedOut, log);
    if (res.timedOut) errors.push(`Formal task timed out.`);

    return {
      success: verdict === "PROVEN" || verdict === "FAILED",
      verdict,
      topModule: options.topModule,
      mode,
      depth,
      engine: "smtbmc_z3",
      failedAssertions: verdict === "FAILED" ? parseFailedAssertions(log) : [],
      workDir: options.keepWorkdir ? workdir : undefined,
      warnings: [],
      errors,
      logTail: logTail(log),
    };
  } finally {
    if (!options.keepWorkdir) {
      await fs.rm(taskPath, { force: true });
      await fs.rm(workPath, { recursive: true, force: true });
      // SBY names the task directory after the task FILE, not workdir:
      // <taskfile>_check/ alongside it. Remove that too.
      const taskDir = path.join(base, path.basename(taskFile, ".sby") + "_check");
      await fs.rm(taskDir, { recursive: true, force: true });
    }
  }
}
