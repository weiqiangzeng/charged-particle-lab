<!-- local-ai-tooling:start -->
# Local AI Tooling Guide

## Project Context

This project may be worked on by Codex or another AI coding agent. Before doing non-trivial work, use the user's local AI capability stack instead of improvising from scratch.

## First Check

Read the local capability router when the task may involve tools, GitHub projects, documents, AI agent configuration, long-running work, or installation decisions:

- `$HOME/.codex/skills/local-ai-tool-orchestrator/SKILL.md`
- `$HOME/.codex/skills/local-ai-tool-orchestrator/references/local-tool-map.md`

## Core Local Skills

- `local-ai-tool-orchestrator`: route tasks to the best local capability.
- `github-project-scout`: evaluate GitHub projects for install/learn/skip decisions.
- `agent-config-guardian`: validate AI agent configs, MCP entries, plugins, and skills.
- `persistent-task-journal`: keep long tasks recoverable across context loss.
- `tool-first-problem-solving`: install or enable mature tools when they improve results.

## Validation Rules

- When editing Codex skills, MCP config, plugin manifests, agent instruction files, hooks, or Codex settings, run `agnix` on the relevant path.
- For Codex skills, also run the Codex skill validator.
- For TOML settings, parse with Python `tomllib`.
- Record permission-sensitive changes and rollback steps.

## Safety Defaults

- Do not run unknown install scripts before reading them.
- Prefer read-only MCP/tool modes first.
- Use narrow permissions for account-connected tools.
- Keep long-running tool/library work documented in `ai-skill-lab` or a local project journal.

## Useful Local Tools

- Search/read code: `rg`, `fd`, `bat`, `tree`, `ast-grep`, `jq`, `yq`
- GitHub: GitHub MCP is configured read-only; `gh` can use the Keychain token when needed
- Agent config validation: `agnix`
- Python tools: `uv`
- Document/PDF/media tools: `markitdown`, `docling`, `pandoc`, `ffmpeg`, `ocrmypdf`, `tesseract`, `LibreOffice`
<!-- local-ai-tooling:end -->
