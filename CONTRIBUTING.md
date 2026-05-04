# Contributing

Thanks for helping improve Obsidian Reader.

## Local Setup

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Development Notes

- Keep prompts in `prompts/`; do not assemble prompts in UI code.
- Keep AI orchestration in `src/core/ai/`.
- Keep Obsidian command flow in `src/commands/`.
- Add focused tests when changing parsing, AI response handling, or user-facing flows.
- Do not commit local Obsidian plugin data such as `data.json`.

## Before Opening a Pull Request

- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build` if the change affects bundled output.
- Check that no API keys, auth tokens, Base URLs for private gateways, vault paths, or local data files are included.
