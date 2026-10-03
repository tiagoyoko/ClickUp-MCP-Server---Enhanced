# ClickUp MCP Server - Core Package

<p align="center">
  <img src="https://raw.githubusercontent.com/Chykalophia/ClickUp-MCP-Server---Enhanced/main/assets/images/clickupserverlogo.png" width="256" alt="ClickUp MCP Server Logo" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@chykalophia/clickup-mcp-server"><img src="https://img.shields.io/npm/v/@chykalophia/clickup-mcp-server.svg" alt="Version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen" alt="Node.js Version"></a>
</p>

A comprehensive Model Context Protocol (MCP) server providing AI assistants with complete ClickUp integration. Features **158 core tools**, **production-grade security**, and **full GitHub Flavored Markdown support**.

## 🚀 Quick Start

### Installation
```bash
npm install @chykalophia/clickup-mcp-server
```

### Configuration
Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "clickup": {
      "command": "npx",
      "args": ["-y", "@chykalophia/clickup-mcp-server"],
      "env": {
        "CLICKUP_API_TOKEN": "YOUR_API_TOKEN_HERE"
      }
    }
  }
}
```

## 🛠️ Features

### Project stage field sync (MCP and CLI)

The `clickup_sync_project_stage_field` MCP tool and the equivalent CLI inspect a
folder-level dropdown named `Etapa`. They reuse an exact match, report drift
without changing it, and default to a dry run. The canonical workflow contains
13 ordered stages from `Backlog` through `Entregue` and `Cancelado`.

```bash
# Inspect only; machine-readable for agents
clickup-project-stage-sync \
  --folder 901711729053 \
  --dry-run \
  --json

# Create only when missing. Both flags are deliberately required because
# ClickUp does not document folder-level custom-field creation.
clickup-project-stage-sync \
  --folder 901711729053 \
  --apply \
  --confirm-create \
  --json
```

Set `CLICKUP_API_TOKEN` in the environment, never in command arguments. The
optional `CLICKUP_PROJECTS_FOLDER_ID` environment variable can replace
`--folder`. Existing definitions are never updated or deleted by this command;
option drift is returned as `manual_update_required` for correction in ClickUp.

### 158 Core Tools
- **Tasks**: Create, update, delete, bulk operations, merging
- **Lists & Spaces**: Complete CRUD operations with safeguards
- **Comments**: Rich markdown support with formatting
- **Attachments**: Upload, download, security validation
- **Custom Fields**: All field types with bulk operations
- **Time Tracking**: Entries, timers, analytics
- **Goals**: All goal types with progress tracking
- **Dependencies**: Relationships and conflict detection
- **Webhooks**: Real-time processing with HMAC validation

### Security Features
- **Zero Vulnerabilities**: Comprehensive security audit
- **Input Validation**: XSS and injection prevention
- **Rate Limiting**: 1000 API, 100 webhook, 10 upload/min
- **HMAC Validation**: Secure webhook authentication
- **File Security**: Path traversal prevention, size limits

### Markdown Support
- **GitHub Flavored Markdown**: Headers, lists, code blocks, tables
- **Smart Processing**: Auto-detection and conversion
- **ClickUp Optimization**: Proper formatting for ClickUp API

## 📋 Tool Examples

### Create a Task
```typescript
clickup_create_task({
  list_id: "123456789",
  name: "Project Setup",
  description: "# Setup\n\n- [ ] Initialize repository\n- [ ] Configure CI/CD",
  priority: 3,
  assignees: [12345]
})
```

### Bulk Operations
```typescript
clickup_bulk_create_tasks({
  list_id: "123456789",
  tasks: [
    { name: "Task 1", description: "First task" },
    { name: "Task 2", description: "Second task" }
  ]
})
```

### Add Comment with Markdown
```typescript
clickup_create_task_comment({
  task_id: "abc123",
  comment_text: "## Status Update\n\n**Progress**: 75% complete\n\n```javascript\nconst status = 'in-progress';\n```"
})
```

## 🔧 Configuration File Locations

- **Claude Desktop (macOS)**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Claude Desktop (Windows)**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Cline VSCode**: `~/.vscode/extensions/saoudrizwan.claude-dev/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

## 🔑 Get ClickUp API Token

1. Log in to ClickUp
2. Go to **Settings** → **Apps**
3. Click **Generate API Token**
4. Copy the token for your configuration

## 📚 Documentation

- [Complete API Coverage](https://github.com/Chykalophia/ClickUp-MCP-Server---Enhanced/blob/main/COMPREHENSIVE_API_COVERAGE.md)
- [Efficiency Guide](https://github.com/Chykalophia/ClickUp-MCP-Server---Enhanced/blob/main/EFFICIENCY_ENHANCEMENT_GUIDE.md)
- [Webhook Processing](https://github.com/Chykalophia/ClickUp-MCP-Server---Enhanced/blob/main/WEBHOOK_PROCESSING_GUIDE.md)

## 🤝 Related Packages

- **[@chykalophia/clickup-intelligence-mcp-server](https://www.npmjs.com/package/@chykalophia/clickup-intelligence-mcp-server)** - AI-powered project intelligence
- **[@chykalophia/clickup-mcp-shared](https://www.npmjs.com/package/@chykalophia/clickup-mcp-shared)** - Shared utilities

## 📄 License

MIT - see [LICENSE](https://github.com/Chykalophia/ClickUp-MCP-Server---Enhanced/blob/main/LICENSE) file for details.

## 🔗 Links

- [GitHub Repository](https://github.com/Chykalophia/ClickUp-MCP-Server---Enhanced)
- [Issues & Support](https://github.com/Chykalophia/ClickUp-MCP-Server---Enhanced/issues)
- [Model Context Protocol](https://modelcontextprotocol.io)
