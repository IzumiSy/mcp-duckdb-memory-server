# MCP DuckDB Knowledge Graph Memory Server

[![Test](https://github.com/izumisy/mcp-duckdb-memory-server/actions/workflows/test.yml/badge.svg)](https://github.com/izumisy/mcp-duckdb-memory-server/actions/workflows/test.yml)
[![smithery badge](https://smithery.ai/badge/@IzumiSy/mcp-duckdb-memory-server)](https://smithery.ai/server/@IzumiSy/mcp-duckdb-memory-server)
![NPM Version](https://img.shields.io/npm/v/%40izumisy%2Fmcp-duckdb-memory-server)
![NPM License](https://img.shields.io/npm/l/%40izumisy%2Fmcp-duckdb-memory-server)

A forked version of [the official Knowledge Graph Memory Server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory).

<a href="https://glama.ai/mcp/servers/4mqwh1toao">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/4mqwh1toao/badge" alt="DuckDB Knowledge Graph Memory Server MCP server" />
</a>

## Installation

### Installing via Smithery

To install DuckDB Knowledge Graph Memory Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@IzumiSy/mcp-duckdb-memory-server):

```bash
npx -y @smithery/cli install @IzumiSy/mcp-duckdb-memory-server --client claude
```

### Manual install

Otherwise, add `@IzumiSy/mcp-duckdb-memory-server` in your `claude_desktop_config.json` manually (`MEMORY_FILE_PATH` is optional)

```bash
{
  "mcpServers": {
    "graph-memory": {
      "command": "npx",
      "args": [
        "-y",
        "@izumisy/mcp-duckdb-memory-server"
      ],
      "env": {
        "MEMORY_FILE_PATH": "/path/to/your/memory.data"
      }
    }
  }
}
```

The data stored on that path is a DuckDB database file.

### Docker

Build

```bash
docker build -t mcp-duckdb-graph-memory .
```

Run

```bash
docker run -dit mcp-duckdb-graph-memory
```

## Usage

Use the example instruction below

```
Follow these steps for each interaction:

1. User Identification:
   - You should assume that you are interacting with default_user
   - If you have not identified default_user, proactively try to do so.

2. Memory Retrieval:
   - Always begin your chat by saying only "Remembering..." and search relevant information from your knowledge graph
   - Create a search query from user words, and search things from "memory". If nothing matches, try to break down words in the query at first ("A B" to "A" and "B" for example).
   - Always refer to your knowledge graph as your "memory"

3. Memory
   - While conversing with the user, be attentive to any new information that falls into these categories:
     a) Basic Identity (age, gender, location, job title, education level, etc.)
     b) Behaviors (interests, habits, etc.)
     c) Preferences (communication style, preferred language, etc.)
     d) Goals (goals, targets, aspirations, etc.)
     e) Relationships (personal and professional relationships up to 3 degrees of separation)

4. Memory Update:
   - If any new information was gathered during the interaction, update your memory as follows:
     a) Create entities for recurring organizations, people, and significant events
     b) Connect them to the current entities using relations
     b) Store facts about them as observations
```

## Motivation

This project enhances the original MCP Knowledge Graph Memory Server by replacing its backend with DuckDB.

### Why DuckDB?

The original MCP Knowledge Graph Memory Server used a JSON file as its data store and performed in-memory searches. While this approach works well for small datasets, it presents several challenges:

1. **Performance**: In-memory search performance degrades as the dataset grows
2. **Scalability**: Memory usage increases significantly when handling large numbers of entities and relations
3. **Query Flexibility**: Complex queries and conditional searches are difficult to implement
4. **Data Integrity**: Ensuring atomicity for transactions and CRUD operations is challenging

DuckDB was chosen to address these challenges:

- **Fast Query Processing**: DuckDB is optimized for analytical queries and performs well even with large datasets
- **SQL Interface**: Standard SQL can be used to execute complex queries easily
- **Transaction Support**: Supports transaction processing to maintain data integrity
- **Indexing Capabilities**: Allows creation of indexes to improve search performance
- **Embedded Database**: Works within the application without requiring an external database server

## Implementation Details

This implementation uses DuckDB as the backend storage system, with a modular architecture designed for reliability and performance.

### System Architecture

The core architecture focuses on the relationship between AI tools, MCP Server, and DB Server:

```mermaid
flowchart LR
    subgraph "AI Tools"
        Claude[Claude AI]
        Cline[Cline AI]
    end
    
    subgraph "MCP Servers"
        MCP1[MCP Server 1]
        MCP2[MCP Server 2]
    end
    
    subgraph "Database Layer"
        DB[DB Server\n<b>Single Connection Manager</b>]
        DuckDB[(DuckDB\nDatabase)]
    end
    
    Claude <--> MCP1
    Cline <--> MCP2
    
    MCP1 --> DB
    MCP2 --> DB
    
    DB <--> DuckDB
    
    %% Annotations
    classDef ai fill:#f9f,stroke:#333,stroke-width:2px;
    classDef server fill:#bbf,stroke:#333,stroke-width:1px;
    classDef db fill:#bfb,stroke:#333,stroke-width:1px;
    
    class Claude,Cline ai;
    class MCP1,MCP2 server;
    class DB,DuckDB db;
```

**Key architectural considerations:**

1. **DuckDB Single Connection Limitation**: DuckDB only allows a single connection for read-write operations. This is a critical constraint that shapes the architecture:
   - The DB Server acts as a connection manager that serializes all database operations
   - Multiple MCP Servers connect to a single DB Server
   - The DB Server ensures only one connection is active with DuckDB at any time

2. **Communication Flow**:
   - AI tools (like Claude and Cline) communicate with MCP Servers using the MCP protocol
   - MCP Servers forward requests to the DB Server using JSON-RPC over Unix socket
   - The DB Server executes SQL queries against DuckDB and returns results

3. **Process Isolation**:
   - The DB Server runs as a separate process for stability
   - Multiple AI instances can connect through different MCP Servers
   - All database operations are funneled through the single DB Server

This architecture elegantly solves DuckDB's single-connection limitation while allowing multiple AI tools to interact with the knowledge graph simultaneously.

### Database Structure

The knowledge graph is stored in a relational database structure as shown below:

```mermaid
erDiagram
    ENTITIES {
        string name PK
        string entityType
    }
    OBSERVATIONS {
        string entityName FK
        string content
    }
    RELATIONS {
        string from_entity FK
        string to_entity FK
        string relationType
    }

    ENTITIES ||--o{ OBSERVATIONS : "has"
    ENTITIES ||--o{ RELATIONS : "from"
    ENTITIES ||--o{ RELATIONS : "to"
```

This schema design allows for efficient storage and retrieval of knowledge graph components while maintaining the relationships between entities, observations, and relations.

### Fuzzy Search Implementation

The implementation combines SQL queries with Fuse.js for flexible entity searching:

- DuckDB SQL queries retrieve the base data from the database
- Fuse.js provides fuzzy matching capabilities on top of the retrieved data
- This hybrid approach allows for both structured queries and flexible text matching
- Search results include both exact and partial matches, ranked by relevance

## Development

### Setup

```bash
pnpm install
```

### Testing

```bash
pnpm test
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
