# Install Vibekit for Gemini CLI

Use this file when asked to install Vibekit in Gemini CLI.

## Install

```bash
gemini extensions install https://github.com/rizukirr/vibekit
```

If prompted to trust the workspace, answer `y`.

## Pin to a known-good ref (optional)

```bash
gemini extensions install https://github.com/rizukirr/vibekit --ref a2bafc6 --consent
```

## Verify

```bash
gemini extensions list
gemini extensions validate ~/.gemini/extensions/vibekit
```

In interactive Gemini CLI:

```text
/extensions list
```

## Update

```bash
gemini extensions update vibekit
```

## Uninstall

```bash
gemini extensions uninstall vibekit
```

## Local fallback

If GitHub installation fails, install from local path:

```bash
gemini extensions install /home/rizki/Projects/vibekit --consent
```
