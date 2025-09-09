#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DuckDBKnowledgeGraphManager } from "./manager";
import { Logger, NullLogger } from "./logger";
import { join, dirname } from "path";
import { homedir } from "os";
import { existsSync, mkdirSync } from "fs";
import { createMCPServer } from "./server";

const main = async () => {
  const logger: Logger = new NullLogger();
  const knowledgeGraphManager = new DuckDBKnowledgeGraphManager(
    /**
     * Get the database file path based on environment variables or default location
     * @returns The path to the database file
     */
    () => {
      if (process.env.MEMORY_FILE_PATH) {
        // Use environment variable if provided
        return process.env.MEMORY_FILE_PATH;
      }

      // Default path: ~/.local/share/duckdb-memory-server/knowledge-graph.json
      const defaultDir = join(
        homedir(),
        ".local",
        "share",
        "duckdb-memory-server"
      );
      const defaultPath = join(defaultDir, "knowledge-graph.data");

      // Create directory if it doesn't exist
      if (!existsSync(dirname(defaultPath))) {
        mkdirSync(dirname(defaultPath), { recursive: true });
      }

      return defaultPath;
    },
    logger
  );

  const server = createMCPServer(knowledgeGraphManager);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("DuckDB Knowledge Graph MCP Server running on stdio");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
