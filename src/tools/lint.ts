import { ToolRunner } from "../runner.js";
import { SvaLintResult } from "../parsers/types.js";

export interface LintSvaOptions {
  verilogSources: string[];
  topModule: string;
  cwd?: string;
  timeoutMs?: number;
}

/**
 * Elaborates RTL (including embedded SVA) with Yosys to catch syntax and
 * elaboration errors before spending solver time. Reports file:line
 * diagnostics; a clean elaboration does NOT mean properties hold.
 */
export async function runLintSva(
  runner: ToolRunner,
  options: LintSvaOptions
): Promise<SvaLintResult> {
  if (options.verilogSources.length === 0) {
    return { success: false, diagnostics: [], warnings: [], errors: ["No Verilog sources specified."] };
  }

  const script = [
    ...options.verilogSources.map((s) => `read_verilog -sv -formal ${s}`),
    `hierarchy -check -top ${options.topModule}`,
    `prep -top ${options.topModule}`,
  ].join("; ");

  const res = await runner.execute("yosys", ["-p", script], {
    cwd: options.cwd,
    timeoutMs: options.timeoutMs ?? 60000,
  });
  const combined = `${res.stdout}\n${res.stderr}`;

  const diagnostics: Array<{ file: string; line?: number; message: string }> = [];
  for (const line of combined.split("\n")) {
    const m = line.match(/^(ERROR|Error|Warning:?)\s*:?\s*(?:(\S+\.s?v):(\d+):?(\d+)?:?)?\s*(.*)$/);
    if (!m) continue;
    const [, sev, file, lineNo, , msg] = m;
    if (/^error/i.test(sev)) {
      diagnostics.push({
        file: file || options.verilogSources[0],
        ...(lineNo ? { line: parseInt(lineNo, 10) } : {}),
        message: (msg || line.trim()).slice(0, 300),
      });
    }
  }

  const errors = diagnostics.map((d) => `${d.file}${d.line ? `:${d.line}` : ""}: ${d.message}`);
  return {
    success: res.exitCode === 0 && errors.length === 0,
    diagnostics,
    warnings: [],
    errors: res.exitCode !== 0 && errors.length === 0 ? [`yosys elaboration failed (exit ${res.exitCode}).`] : errors,
  };
}
