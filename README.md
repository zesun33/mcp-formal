# @zesun33/mcp-formal

> Model Context Protocol (MCP) server for SymbiYosys formal verification (BMC/prove) and SVA linting.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![CI](https://github.com/zesun33/mcp-formal/actions/workflows/ci.yml/badge.svg)](https://github.com/zesun33/mcp-formal/actions/workflows/ci.yml)
[![Protocol: MCP](https://img.shields.io/badge/protocol-MCP_stdio-blueviolet)](https://modelcontextprotocol.io)
[![Runtime: Rootless Podman](https://img.shields.io/badge/runtime-rootless_podman-brightgreen)](#execution-runtime)

`mcp-formal` lets AI coding agents and IDEs (**Cursor**, **Windsurf**, **GitHub Copilot / OpenAI Codex**, **Claude Code**, **Google Antigravity**, **OpenCode**, **Cline**) prove SystemVerilog assertions with SymbiYosys (`smtbmc+z3`) instead of only simulating them. Author properties first with `rtl_generate_assertion` (`mcp-rtl-review`), then prove them here: verdicts are PROVEN, FAILED (with counterexample asserts), UNKNOWN, ERROR, or TIMEOUT — never a silent pass.

> Engine reality (verified live): the image ships SBY with the `smtbmc z3` engine (z3 5.1.0). The ABC/PDR engine is excluded: it crashes parsing witness output against this Yosys build. Sequential/multi-clock properties may report UNKNOWN or exhaust depth instead of proving; treat those as work for deeper bounds or induction, not as passes.

---

## ⚡ Quick Tour: See It in Action

### Real Agent Scenarios in 60 Seconds

#### 1. Probing the Toolchain (Zero-Config Verification)
```json
// Tool Call: formal_toolchain_info
{
  "runtime": "podman",
  "image": "ghcr.io/zesun33/asic",
  "solvers": ["z3 (Z3 version 5.1.0 - 64 bit)"],
  "engines": ["smtbmc_z3"]
}
```

#### 2. Proving a Holding Assertion (Bounded)
```json
// Tool Call: formal_prove {"verilog_sources": ["counter_assert_ok.sv"], "top_module": "cnt_ok", "mode": "bmc", "depth": 6}
{
  "success": true,
  "verdict": "PROVEN",
  "mode": "bmc",
  "depth": 6,
  "failedAssertions": []
}
```

#### 3. Refuting a False Assertion (Counterexample Triage)
```json
// Tool Call: formal_prove {"verilog_sources": ["counter_assert_bad.sv"], "top_module": "cnt_bad", "mode": "bmc", "depth": 6}
{
  "success": true,
  "verdict": "FAILED",
  "failedAssertions": [
    { "name": "cnt_bad.$assert$counter_assert_bad.sv:14$1", "location": "counter_assert_bad.sv:14", "step": 1 }
  ]
}
```

#### 4. Catching Syntax Errors Before Solver Time
```json
// Tool Call: formal_lint_sva {"verilog_sources": ["sva_syntax_bad.sv"], "top_module": "sva_broken"}
{
  "success": false,
  "errors": ["sva_syntax_bad.sv:14: syntax error ..."]
}
```

---

## Tools Exposed

| Tool | Parameters | Engine | Description |
| :--- | :--- | :--- | :--- |
| `formal_prove` | `verilog_sources: string[]`, `top_module: string`, `mode?: "bmc" \| "prove"`, `depth?: number [1,100]`, `defines?: string[]`, `keep_workdir?: boolean`, `cwd?: string` | SBY `smtbmc z3` | Proves embedded assertions; honest 5-state verdict with counterexample locations. Pass `defines: ["FORMAL"]` with `` `ifdef FORMAL ``-guarded SVA (iverilog cannot parse assertions). |
| `formal_lint_sva` | `verilog_sources: string[]`, `top_module: string`, `cwd?: string` | Yosys elaboration | Catches SVA syntax/elaboration errors with file:line diagnostics. Proves nothing. |
| `formal_toolchain_info` | *none* | Probe | SBY version, SMT solvers, and proof engines. |

---

## Execution Runtime

`mcp-formal` runs inside the [`zesun33/asic`](https://github.com/zesun33/eda-docker-images) rootless Podman image so tools are identical on any Linux host.

**Public install (recommended — anyone can pull):**
```bash
podman pull ghcr.io/zesun33/asic:latest
export MCP_FORMAL_IMAGE=ghcr.io/zesun33/asic
```

Local builds from `eda-docker-images` still work as `localhost/zesun33/asic` (the historical default). Override anytime with `MCP_FORMAL_IMAGE`.

- Container mount: `-v <workspace>:/workspace:Z -w /workspace`
- Podman storage option: `--storage-opt overlay.ignore_chown_errors=true`

To force host binaries instead of container execution:
```bash
export MCP_FORMAL_RUNTIME=host
```

Requires SymbiYosys + z3 in the image (shipped in `zesun33/asic`).


---

## Universal Client & AI IDE Setup

Because `mcp-formal` implements the standard [Model Context Protocol (MCP)](https://modelcontextprotocol.io), it connects seamlessly to any MCP-compliant AI IDE or agent interface:

```json
{
  "mcpServers": {
    "formal": {
      "command": "node",
      "args": ["/path/to/mcp-formal/dist/index.js"]
    }
  }
}
```

- **Cursor**: Configure in `.cursor/mcp.json`.
- **Windsurf**: Configure in `~/.codeium/windsurf/mcp_config.json`.
- **GitHub Copilot / OpenAI Codex**: Configure via Copilot MCP settings or Codex tool proxy.
- **Claude Code**: Configure via `claude mcp add formal node /path/to/dist/index.js`.
- **Google Antigravity**: Load as workspace MCP server in `antigravity.json`.
- **OpenCode & Cline**: Direct stdio JSON-RPC connection.

---

## Verification & Testing

Run the full 6-gate verification suite:

```bash
# Full verification (with Podman SBY runs)
./scripts/verify.sh

# Fast / CI verification (headless environments)
./scripts/verify.sh --quick
```

## License

Apache-2.0 © 2026 Md Zesun Ahmed Mia
