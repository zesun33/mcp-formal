import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { ToolRunner } from "./runner.js";
import { runFormalProve } from "./tools/prove.js";
import { runLintSva } from "./tools/lint.js";
import { getFormalToolchainInfo } from "./tools/toolchain.js";

export function createServer(runner: ToolRunner = new ToolRunner()): Server {
  const server = new Server(
    {
      name: "@zesun33/mcp-formal",
      version: "0.1.1",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const tools: Tool[] = [
    {
      name: "formal_prove",
      description:
        "Proves SystemVerilog assertions embedded in RTL with SymbiYosys (smtbmc+z3), bounded (bmc) or inductive (prove). Returns PROVEN, FAILED with counterexample asserts, UNKNOWN, ERROR, or TIMEOUT. Author properties first with rtl_generate_assertion (mcp-rtl-review); a passing lint does not mean properties hold.",
      inputSchema: {
        type: "object",
        properties: {
          verilog_sources: {
            type: "array",
            items: { type: "string" },
            description: "RTL files containing the design and embedded assert properties.",
          },
          top_module: {
            type: "string",
            description: "Top module name.",
          },
          mode: {
            type: "string",
            enum: ["bmc", "prove"],
            description: "Bounded check to depth (bmc) or full induction attempt (prove). Default: bmc.",
          },
          depth: {
            type: "number",
            description: "Bound depth in [1, 100] (default: 10). Deeper bounds cost solver time.",
          },
          defines: {
            type: "array",
            items: { type: "string" },
            description: 'Preprocessor defines for the read step, e.g. ["FORMAL"] to enable `ifdef FORMAL assertion blocks (iverilog cannot parse SVA, so guard solver-only constructs).',
          },
          keep_workdir: {
            type: "boolean",
            description: "Keep the SBY work directory for trace inspection (default: false).",
          },
          cwd: {
            type: "string",
            description: "Optional working directory.",
          },
          timeout_ms: {
            type: "number",
            description: "Maximum task time in milliseconds (default: 300000).",
          },
        },
        required: ["verilog_sources", "top_module"],
      },
    },
    {
      name: "formal_lint_sva",
      description:
        "Elaborates RTL with embedded SVA in Yosys to catch syntax and elaboration errors before solver time. Reports file:line diagnostics. Does not prove anything; use formal_prove for verdicts.",
      inputSchema: {
        type: "object",
        properties: {
          verilog_sources: {
            type: "array",
            items: { type: "string" },
            description: "RTL files to elaborate.",
          },
          top_module: {
            type: "string",
            description: "Top module name.",
          },
          cwd: {
            type: "string",
            description: "Optional working directory.",
          },
        },
        required: ["verilog_sources", "top_module"],
      },
    },
    {
      name: "formal_toolchain_info",
      description:
        "Returns active container/host runtime and versions of SymbiYosys, SMT solvers, and proof engines.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case "formal_prove": {
          const result = await runFormalProve(runner, {
            verilogSources: (args.verilog_sources as string[]) || [],
            topModule: (args.top_module as string) || "",
            mode: (args.mode as "bmc" | "prove" | undefined) ?? undefined,
            depth: typeof args.depth === "number" ? args.depth : undefined,
            defines: Array.isArray(args.defines) ? (args.defines as string[]) : undefined,
            keepWorkdir: Boolean(args.keep_workdir),
            cwd: args.cwd as string | undefined,
            timeoutMs: typeof args.timeout_ms === "number" ? args.timeout_ms : undefined,
          });
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        case "formal_lint_sva": {
          const result = await runLintSva(runner, {
            verilogSources: (args.verilog_sources as string[]) || [],
            topModule: (args.top_module as string) || "",
            cwd: args.cwd as string | undefined,
          });
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        case "formal_toolchain_info": {
          const result = await getFormalToolchainInfo(runner);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        default:
          return {
            content: [{ type: "text", text: `Error: Unknown tool "${name}".` }],
            isError: true,
          };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Tool execution failed: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}
