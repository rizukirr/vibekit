# Vibekit for Gemini CLI

Guide for using vibekit with Gemini CLI extensions.

## Quick Install

```bash
gemini extensions install https://github.com/rizukirr/vibekit
```

Restart Gemini CLI after installation.

> **One-time setup:** Gemini CLI does not auto-discover skills the way the other runtimes do. After install, author a local `GEMINI.md` at the extension root that imports each skill via `@./skills/<name>/SKILL.md`. See `INSTALL.gemini.md` for a copy-pasteable minimum `GEMINI.md`. The file is gitignored, so this step runs once per install.

## Local Development Install

From this repository:

```bash
gemini extensions link .
```

This links your working tree directly so local edits are reflected immediately.

## Verify

```bash
gemini extensions list
gemini extensions validate .
```

Inside Gemini interactive mode:

```text
/extensions list
```

You should see `vibekit` installed and enabled.

## Update

```bash
gemini extensions update vibekit
```

## Uninstall

```bash
gemini extensions uninstall vibekit
```
