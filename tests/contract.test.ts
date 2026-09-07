import test from "node:test";
import assert from "node:assert/strict";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "../src/server.js";

test("MCP server registers required formal tools", async () => {
  const server = createServer();

  const handler = (server as any)._requestHandlers.get(ListToolsRequestSchema.shape.method.value);
  assert.ok(handler, "ListTools handler must be registered");

  const response = await handler({ method: "tools/list" });
  assert.ok(response.tools, "Tools list must be returned");

  const toolNames = response.tools.map((t: any) => t.name);
  assert.ok(toolNames.includes("formal_prove"), "formal_prove must be present");
  assert.ok(toolNames.includes("formal_lint_sva"), "formal_lint_sva must be present");
  assert.ok(toolNames.includes("formal_toolchain_info"), "formal_toolchain_info must be present");

  for (const tool of response.tools) {
    assert.equal(tool.inputSchema.type, "object");
    assert.ok(tool.description && tool.description.length > 10);
  }
});
