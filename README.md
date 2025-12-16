# Docs Query MCP - Node.js

> 🚀 100% Node.js / TypeScript + 本地嵌入模型实现，可直接通过 `npx docs-mcp <command>` 使用。

这是一个原生 Node.js/TypeScript 项目，所有功能都封装为 npm 包，可通过 `npm install` 本地运行，也可以在未克隆仓库的情况下用 `npx` 直接拉起 CLI。摄取目标不限于某个特定仓库，只要是 Markdown/MDX 文档（或你扩展的扩展名），即可构建本地向量索引与 MCP 工具，对任意项目实现“提取→检索→MCP 暴露”的通用流程。

## 亮点

- **通用文档提取**：任意 Markdown/MDX 目录都能摄取；你可为公司知识库、产品手册或博客生成同一套索引与 MCP 工具。
- **纯 Node 环境**：无需额外 runtime，直接 `npm install` 即可构建。
- **只支持本地模型**：默认使用 `@xenova/transformers` 提供的量化版 `Xenova/bge-base-zh-v1.5`，完全离线。
- **多入口 CLI**：`ingest-docs`、`query-docs`、`mcp-docs-server` 三个命令可单独执行，也可通过总入口 `docs-mcp <command>` 运行，方便 `npx` 调用。
- **统一持久化**：索引以 `storage/llamaindex/index.json` 存储，`ingest` / `query` / `MCP` 共用该文件。
- **FastMCP 支持**：`mcp-docs-server` 用 @modelcontextprotocol/sdk 暴露 `docs_query` 工具，CLI 可以直接挂载。

## 快速开始

```bash
# 1) 安装依赖并构建 TypeScript
npm install
npm run build

# 2) 摄取文档（示例：中英文文档库）
node dist/bin/ingest-docs.js \
  --docs-root ../your-docs-repo/docs/zh:zh \
  --docs-root ../your-docs-repo/docs/en:en \
  --persist-dir storage/llamaindex --clean

# 3) 查询
node dist/bin/query-docs.js "如何自定义导航栏？" --model raw

# 4) 启动 MCP 服务器（stdio）
node dist/bin/mcp-docs-server.js --persist-dir storage/llamaindex
```

### `npx` 使用方式

发布到 npm 之后，可直接通过下列命令远程执行（无需克隆）：

```bash
npx docs-mcp ingest \
  --docs-root /abs/path/docs/zh:zh --persist-dir storage/llamaindex --clean

npx docs-mcp query "How do I customize navigation?" --model raw

npx docs-mcp mcp --persist-dir storage/llamaindex --default-k 6
```

`npx docs-mcp <command>` 会根据 `<command>` 派发到对应二进制；如果你更喜欢直接调用，也可以 `npx docs-mcp ingest-docs ...`。

## 命令详解

### ingest-docs

```bash
npx docs-mcp ingest \
  --docs-root /abs/path/docs/en:en \
  --docs-root /abs/path/docs/zh:zh \
  --persist-dir storage/llamaindex --clean \
  --embedding-model Xenova/bge-base-zh-v1.5 \
  --chunk-size 750 --chunk-overlap 120
```

- `--docs-root PATH[:LANG]`：可重复传入，默认 `docs/en:en`。语言标签写入 metadata，用于后续过滤。
- `--persist-dir`：索引输出目录（默认 `storage/llamaindex`）。加 `--clean` 会先删除旧索引。
- `--extensions`：默认 `.md .mdx`。
- `--embedding-model`：任意 `@xenova/transformers` 支持的本地模型（建议 `Xenova/bge-base-zh-v1.5` / `Xenova/bge-base-en-v1.5`）。

摄取完成后会在 `persistDir/index.json` 写入：

```json
{
  "version": 1,
  "embeddingModel": "Xenova/bge-base-zh-v1.5",
  "documents": [
    {
      "id": "zh-0",
      "text": "...chunk...",
      "metadata": { "path": "guide/getting-started.md", "lang": "zh", "section": "guide" },
      "embedding": [0.01, -0.02, ...]
    }
  ]
}
```

### query-docs

```bash
npx docs-mcp query "How do I customize navigation?" \
  --persist-dir storage/llamaindex --k 5 --model raw
```

- `--model`：`raw`（打印 prompt）、`codex|claude|gemini`（将 prompt 写入对应 CLI 的 stdin）、`mcp`（输出 JSON，方便管道）。
- `--cli-path`：当 `--model codex|claude|gemini` 时，覆盖默认 CLI 路径。
- `--embedding-model`：需要与 ingest 阶段一致，否则会提示警告。

### mcp-docs-server

```bash
npx docs-mcp mcp \
  --persist-dir storage/llamaindex \
  --embedding-model Xenova/bge-base-zh-v1.5 \
  --default-k 4
```

- 以 stdio 模式运行 FastMCP 服务器，暴露 `docs_query({ question, k? })`。
- `k` 省略时回退到 `--default-k`。
- MCP 客户端配置示例：

```json
{
  "servers": {
    "docs_mcp": {
      "command": "npx",
      "args": ["docs-mcp", "mcp", "--persist-dir", "/abs/path/storage/llamaindex"]
    }
  }
}
```

## 本地嵌入模型

项目只依赖 `@xenova/transformers`，默认启用 `env.allowLocalModels = true` 并加载量化模型。首次运行会自动在 `~/.cache` 下载一次模型文件（约 400MB），后续命令复用缓存。

- 如果需要英文数据集，推荐 `Xenova/bge-base-en-v1.5`。
- 如需更大的跨语模型，可切换 `Xenova/bge-m3`，但内存占用也会更高。

## 目录结构

```
.
├── package.json
├── tsconfig.json
├── src/
│   ├── bin/               # CLI 入口
│   ├── commands/          # ingest/query/mcp 实现
│   └── core/              # chunking、embedding、存储等工具
├── dist/                  # tsc 输出
└── storage/llamaindex     # 索引输出（未提交）
```

## License

MIT

