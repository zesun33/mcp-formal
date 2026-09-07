import { ToolRunner } from "../runner.js";
import { FormalToolchainInfo } from "../parsers/types.js";

async function probe(runner: ToolRunner, cmd: string, args: string[], cwd?: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await runner.execute(cmd, args, { cwd });
      const out = `${res.stdout}\n${res.stderr}`.split("\n").map((l) => l.trim()).find((l) => l.length > 0) || "";
      if (res.exitCode === 0 && out) return out.slice(0, 120);
    } catch {
      // retry below
    }
  }
  return "Not found";
}

export async function getFormalToolchainInfo(runner: ToolRunner, cwd?: string): Promise<FormalToolchainInfo> {
  const sby = await probe(runner, "sby", ["--help"], cwd);
  const z3 = await probe(runner, "z3", ["--version"], cwd);
  const smtbmc = await probe(runner, "yosys-smtbmc", ["--help"], cwd);

  return {
    runtime: runner.getRuntime(),
    image: runner.getRuntime() !== "host" ? runner.getImageName() : undefined,
    sbyVersion: sby,
    solvers: z3 === "Not found" ? [] : [`z3 (${z3})`],
    engines: smtbmc === "Not found" ? [] : ["smtbmc_z3"],
  };
}
