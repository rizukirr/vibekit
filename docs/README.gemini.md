# Vibekit for Gemini CLI

Guide for using vibekit with Gemini CLI extensions.

## Quick Install

```bash
gemini extensions install https://github.com/rizukirr/vibekit
```

Restart Gemini CLI after installation.

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
