#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { toolsSchema } from "./toolsSchema";
import { DuckDBFuseKnowledgeGraphManager } from "./adapters/duckdb-fuse";
import { Entity, Observation, Relation } from "./types";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { join, dirname } from "path";
import { homedir } from "os";
import { existsSync, mkdirSync } from "fs";
import { LowDBFuseKnowledgeGraphManager } from "./adapters/lowdb-fuse";

const server = new Server(
  {
    name: "pluggable-memory-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolsSchema,
  };
});

/**
 * Get the database file path based on environment variables or default location
 * @returns The path to the database file
 */
function getDbPath(): string {
  if (process.env.MEMORY_FILE_PATH) {
    // Use environment variable if provided
    return process.env.MEMORY_FILE_PATH;
  }

  // Default path: ~/.local/share/pluggable-memory-server/knowledge-graph.json
  const defaultDir = join(
    homedir(),
    ".local",
    "share",
    "pluggable-memory-server"
  );
  const defaultPath = join(defaultDir, "knowledge-graph.json");

  // Create directory if it doesn't exist
  if (!existsSync(dirname(defaultPath))) {
    mkdirSync(dirname(defaultPath), { recursive: true });
  }

  return defaultPath;
}

const knowledgeGraphManager = new LowDBFuseKnowledgeGraphManager(getDbPath());

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  switch (name) {
    case "create_entities":
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              await knowledgeGraphManager.createEntities(
                args.entities as Entity[]
              ),
              null,
              2
            ),
          },
        ],
      };
    case "create_relations":
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              await knowledgeGraphManager.createRelations(
                args.relations as Relation[]
              ),
              null,
              2
            ),
          },
        ],
      };
    case "add_observations":
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              await knowledgeGraphManager.addObservations(
                args.observations as {
                  entityName: string;
                  contents: string[];
                }[]
              ),
              null,
              2
            ),
          },
        ],
      };
    case "delete_entities":
      await knowledgeGraphManager.deleteEntities(args.entityNames as string[]);
      return {
        content: [{ type: "text", text: "Entities deleted successfully" }],
      };
    case "delete_observations":
      await knowledgeGraphManager.deleteObservations(
        args.deletions as Array<Observation>
      );
      return {
        content: [{ type: "text", text: "Observations deleted successfully" }],
      };
    case "delete_relations":
      await knowledgeGraphManager.deleteRelations(
        args.relations as Array<Relation>
      );
      return {
        content: [{ type: "text", text: "Relations deleted successfully" }],
      };
    case "search_nodes":
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              await knowledgeGraphManager.searchNodes(args.query as string),
              null,
              2
            ),
          },
        ],
      };
    case "open_nodes":
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              await knowledgeGraphManager.openNodes(args.names as string[]),
              null,
              2
            ),
          },
        ],
      };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Pluggable Knowledge Graph MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
