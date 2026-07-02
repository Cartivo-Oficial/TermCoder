# Troubleshooting

## "No model credentials" / every model rate-limits

termcoder needs at least one provider. The cheapest paths, in order:

- **Ollama (free, local, no account):** install [Ollama](https://ollama.com), run
  `ollama pull llama3.1`, then set `"model": "ollama/llama3.1"`. No key needed.
- **Google Gemini (free tier):** get a key at
  [aistudio.google.com](https://aistudio.google.com/apikey), export `GEMINI_API_KEY`,
  set `"model": "google/gemini-2.0-flash"`.
- **`termcoder/auto`** routes to whichever provider you've configured, preferring
  free/local — a safe default once any key is set.

Small local models follow the tool-calling protocol less reliably; prefer `qwen2.5` or a
larger instruct model if a tiny one struggles.

## Tools never run / everything asks for permission

Mutating tools (write/edit/bash) pass through the permission gate. Set a class to
`"allow"` in config, use `/auto` in the TUI (or the auto toggle in the desktop app), or
scope it with a glob rule — see [Configuration → Permissions](./configuration.md#permissions).

## The desktop app shows an old icon

If a rebuilt `.exe` still shows a stale icon in Explorer or the taskbar, it's the Windows
icon cache, not the build. The packaged icon is a proper multi-size `.ico` (BMP for
16–128px, PNG for 256px — the shell won't render PNG at small sizes). Force a refresh:

```powershell
ie4uinit.exe -show
```

If it persists, delete `%LOCALAPPDATA%\Microsoft\Windows\Explorer\iconcache_*.db` and sign
out/in (or reboot). In **dev** the Windows taskbar shows the generic Electron icon because
the running binary is `electron.exe`; the packaged app embeds our icon.

## MCP server changes don't take effect

Adding, toggling, or removing an MCP server rewrites config immediately but the connection
is only (re)established on the next start. Restart termcoder after changing `mcp`.

## Microphone / voice dictation does nothing

Voice uses the microphone plus a multimodal model for transcription. Grant mic access when
prompted, and make sure a provider that supports audio (e.g. Google Gemini) is configured.

## Notifications look plain

The desktop app posts its "task finished" toast through the OS with the termcoder icon.
On Windows, toasts only appear when Focus Assist allows them and notifications are enabled
for the app in system settings.
