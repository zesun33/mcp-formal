import { FormalVerdict, FailedAssertion } from "./types.js";

export interface SbyTaskSpec {
  taskName: string;
  mode: "bmc" | "prove";
  depth: number;
  engineLine: string;
  topModule: string;
  sources: string[];
  defines: string[];
  workSubdir: string;
}

/**
 * Generates a SymbiYosys task file. Engine line is bare (no colon prefix:
 * `smtbmc z3`); a colon turns the line into a task tag and SBY rejects it.
 * NOTE: never append `--noprogress` — SBY forwards it to the solver via
 * `-S` and z3 exits on the unknown flag, breaking the pipe.
 */
export function generateSbyFile(spec: SbyTaskSpec): string {
  // SBY copies [files] into <task>/src/ and runs [script] from there:
  // the script must reference basenames, never the caller's paths.
  const baseNames = spec.sources.map((s) => s.split("/").pop() ?? s);
  const defineFlags = spec.defines.map((d) => `-D ${d}`).join(" ");
  return `[tasks]
${spec.taskName}: ${spec.mode} -d ${spec.workSubdir}

[options]
${spec.taskName}: mode ${spec.mode}
${spec.taskName}: depth ${spec.depth}

[engines]
${spec.engineLine}

[script]
read -sv ${defineFlags ? defineFlags + " " : ""}${baseNames.join(" ")}
prep -top ${spec.topModule}

[files]
${spec.sources.join("\n")}
`;
}

export interface FailedAssertionMatch {
  name: string;
  file: string;
  line?: number;
  step?: number;
}

function matchFailedLine(line: string): FailedAssertionMatch | null {
  // SBY summary form: `failed assertion MOD.$assert$FILE:LINE$N at FILE:LINE.C-LINE.C step S`
  let m = line.match(/failed\s+assertion\s+(\S+)\s+at\s+(\S+?\.sv):(\d+)[^\s]*\s+step\s+(\d+)/i);
  if (m) {
    return { name: m[1], file: m[2], line: parseInt(m[3], 10), step: parseInt(m[4], 10) };
  }
  // Engine form: `Assert failed in MOD: FILE:LINE...`
  m = line.match(/Assert\s+failed\s+in\s+(\S+):\s*(\S+?\.sv):(\d+)/i);
  if (m) {
    return { name: m[1], file: m[2], line: parseInt(m[3], 10) };
  }
  return null;
}

export function parseFailedAssertions(log: string): FailedAssertion[] {
  const out: FailedAssertion[] = [];
  const seen = new Set<string>();
  for (const line of log.split("\n")) {
    const m = matchFailedLine(line);
    if (!m) continue;
    const key = `${m.name}@${m.file}:${m.line ?? "?"}:${m.step ?? "?"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: m.name,
      location: m.line !== undefined ? `${m.file}:${m.line}` : m.file,
      step: m.step,
    });
    if (out.length >= 10) break;
  }
  return out;
}

export function parseSbyVerdict(
  exitCode: number,
  timedOut: boolean,
  log: string
): { verdict: FormalVerdict; errors: string[] } {
  const errors: string[] = [];
  for (const line of log.split("\n")) {
    const t = line.trim();
    if (t.startsWith("ERROR:") && !/engine_0: Engine terminated/.test(t)) {
      errors.push(t.slice(0, 200));
    }
  }

  if (timedOut) return { verdict: "TIMEOUT", errors };
  if (/DONE \(PASS/.test(log)) return { verdict: "PROVEN", errors: [] };
  if (/DONE \(FAIL/.test(log) || /Status: failed/i.test(log)) {
    return { verdict: "FAILED", errors };
  }
  if (/DONE \(UNKNOWN/.test(log)) return { verdict: "UNKNOWN", errors };
  if (/DONE \(ERROR/.test(log) || errors.length > 0) return { verdict: "ERROR", errors };
  return { verdict: "UNKNOWN", errors: ["SBY produced no DONE verdict line."] };
}

export function logTail(log: string, maxLines: number = 12): string[] {
  return log
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => /SBY .* \[(check|engine_0|summary)\]|DONE \(|Assert failed|BMC |Status:|Solver:/.test(l))
    .slice(-Math.max(1, maxLines));
}
