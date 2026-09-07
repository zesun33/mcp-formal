import test from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ToolRunner } from "../src/runner.js";
import { runFormalProve } from "../src/tools/prove.js";
import { runLintSva } from "../src/tools/lint.js";
import { getFormalToolchainInfo } from "../src/tools/toolchain.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const runner = new ToolRunner();

test("Integration: formal_toolchain_info reports sby and z3", async () => {
  const info = await getFormalToolchainInfo(runner, projectRoot);
  assert.equal(info.runtime, "podman");
  assert.ok(info.sbyVersion.length > 0 && info.sbyVersion !== "Not found");
  assert.ok(info.solvers.some((s) => s.startsWith("z3")), `Expected z3 solver, got: ${info.solvers}`);
  assert.ok(info.engines.includes("smtbmc_z3"));
});

test("Integration: formal_lint_sva passes clean assertions", async () => {
  const res = await runLintSva(runner, {
    verilogSources: ["fixtures/counter_assert_ok.sv"],
    topModule: "cnt_ok",
    cwd: projectRoot,
  });
  assert.equal(res.success, true, `Lint failed: ${res.errors.join("; ")}`);
});

test("Integration: formal_lint_sva catches syntax errors", async () => {
  const res = await runLintSva(runner, {
    verilogSources: ["fixtures/sva_syntax_bad.sv"],
    topModule: "sva_broken",
    cwd: projectRoot,
  });
  assert.equal(res.success, false);
  assert.ok(res.errors.length > 0);
});

test("Integration: formal_prove passes a holding assertion (bmc)", async () => {
  const res = await runFormalProve(runner, {
    verilogSources: ["fixtures/counter_assert_ok.sv"],
    topModule: "cnt_ok",
    mode: "bmc",
    depth: 6,
    cwd: projectRoot,
    timeoutMs: 300000,
  });
  assert.equal(res.verdict, "PROVEN", `Expected PROVEN: ${res.verdict} ${res.errors.join("; ")} ${res.logTail.join(" | ")}`);
  assert.equal(res.success, true);
});

test("Integration: formal_prove refutes a false assertion with location", async () => {
  const res = await runFormalProve(runner, {
    verilogSources: ["fixtures/counter_assert_bad.sv"],
    topModule: "cnt_bad",
    mode: "bmc",
    depth: 6,
    cwd: projectRoot,
    timeoutMs: 300000,
  });
  assert.equal(res.verdict, "FAILED");
  assert.equal(res.success, true);
  assert.ok(res.failedAssertions.length > 0, "Expected counterexample asserts");
});

test("Integration: formal_prove rejects bad depth without spawning", async () => {
  const res = await runFormalProve(runner, {
    verilogSources: ["fixtures/counter_assert_ok.sv"],
    topModule: "cnt_ok",
    depth: 500,
    cwd: projectRoot,
  });
  assert.equal(res.success, false);
  assert.equal(res.verdict, "ERROR");
});
