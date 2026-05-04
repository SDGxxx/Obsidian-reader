# Security Policy

## Sensitive Data

Obsidian Reader stores plugin settings through Obsidian's plugin data APIs. Depending on your settings, the local plugin `data.json` may contain:

- API keys
- Auth tokens
- Custom Base URLs for private gateways

Do not upload `data.json` or your vault `.obsidian/` directory to public repositories.

## Safer Secret Handling

Disable **Remember Secret** in plugin settings if you do not want the secret written to Obsidian's plugin data file. In that mode the secret only lives in the current Obsidian session and must be entered again after restart.

## Reporting Issues

If you find a security issue, please avoid posting secrets or exploit details in public issues. Open a minimal issue describing the affected area and coordinate privately before sharing sensitive details.
