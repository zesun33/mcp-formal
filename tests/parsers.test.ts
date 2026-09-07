import test from "node:test";
import assert from "node:assert/strict";
import {
  generateSbyFile,
  parseFailedAssertions,
  parseSbyVerdict,
} from "../src/parsers/sby.js";

test("generateSbyFile uses bare engine lines and task-scoped options", () => {
  const sby = generateSbyFile({
    taskName: "check",
    mode: "bmc",
    depth: 10,
    engineLine: "smtbmc z3",
    topModule: "cnt",
    sources: ["cnt.sv"],
    defines: [],
    workSubdir: "run",
  });
  assert.match(sby, /\[tasks\]/);
  assert.match(sby, /check: bmc -d run/);
  assert.match(sby, /\nsmtbmc z3\n/);
  assert.ok(!sby.includes("smtbmc:"), "engine line must not carry a colon (task-tag gotcha)");
  assert.ok(!sby.includes("--noprogress"), "must not forward --noprogress to the solver");
  assert.match(sby, /prep -top cnt/);
});

test("parseSbyVerdict classifies PASS, FAIL, and ERROR logs", () => {
  assert.equal(parseSbyVerdict(0, false, "x\nSBY [a] DONE (PASS, rc=0)\n").verdict, "PROVEN");
  const failed = parseSbyVerdict(2, false, "Status: failed\nSBY [a] DONE (FAIL, rc=2)\n");
  assert.equal(failed.verdict, "FAILED");
  assert.equal(parseSbyVerdict(0, false, "nothing here").verdict, "UNKNOWN");
  assert.equal(parseSbyVerdict(1, false, "ERROR: something broke").verdict, "ERROR");
  assert.equal(parseSbyVerdict(0, true, "").verdict, "TIMEOUT");
});

test("parseFailedAssertions extracts name, location, and step", () => {
  const log = `SBY [t] summary:   failed assertion cnt.$assert$cnt.sv:14$5 at cnt.sv:14.9-14.36 step 1
SBY [t] summary:   failed assertion cnt.$assert$cnt.sv:14$5 at cnt.sv:14.9-14.36 step 1
`;
  const out = parseFailedAssertions(log);
  assert.equal(out.length, 1);
  assert.match(out[0].name, /assert/);
  assert.equal(out[0].step, 1);
});
