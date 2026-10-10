# OpenAI submission package

Build the skills-only OpenAI upload separately from the installation packages. Requirements were checked against the [official submission documentation](https://developers.openai.com/plugins/deploy/submission) on 2026-10-08. Recheck that page and the [plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines) before submitting.

## Build and inspect

Prerequisites: Node.js 24 or newer and native `zip` and `unzip` commands on PATH. Run from the repository root:

```sh
npm run package:submission
```

The command reads `vibekit.config.json` for the name and version and writes `dist/openai/vibekit-<current-version>.zip`. For version 0.6.5 the path is `dist/openai/vibekit-0.6.5.zip`. Archives stay ignored by Git. A failed build preserves a preexisting destination archive.

Inspect the actual archive before upload:

```sh
unzip -l dist/openai/vibekit-0.6.5.zip
unzip -p dist/openai/vibekit-0.6.5.zip .codex-plugin/plugin.json
```

Extract into a fresh temporary directory with `unzip`, then inspect every manifest resource. The archive contains `.codex-plugin/plugin.json`, discovered skill directories and resources, a generated `AGENTS.md` trigger reference, `assets/icon.svg`, `LICENSE`, `PRIVACY.md`, and this guide as `README.md`. It has no lifecycle hooks, app references, portable root manifest, repository metadata, or development tooling.

The builder checks identity, listing text, declared icons, local Markdown resource links, unsafe paths, symbolic links, and common secret filenames and key signatures. Fenced example paths and inline code paths describing future project documents are not bundled dependencies. This is targeted local validation. It does not reproduce OpenAI's review scanner or imply portal acceptance. Review resources for sensitive information before upload.

## Activate in Codex

After installing the package in a compatible Codex environment, explicitly ask: "Use Vibekit and invoke the using-vibekit skill for this conversation." Start each new conversation with explicit activation when needed. The submission has no session startup hook. The onboarding skill links to the packaged trigger reference. A plugin-root `AGENTS.md` is a referenced resource, and is not assumed to load automatically.

Use Codex's skill invocation mechanism when available. When the host has no dedicated invocation tool, read the matching bundled `skills/<name>/SKILL.md` and follow it. System and developer instructions retain priority over skill guidance.

The staged startup skill adapts invocation, resource lookup, activation, and instruction priority for Codex. Other skill instructions are copied verbatim. An audit found concrete host dependencies: filesystem and command tools for coding and verification, Git for branch and commit workflows, fresh subagents and enforceable read-only tool restrictions for `exec`, `debug`, and parts of `verify`, and `gh` with authorized GitHub access for optional PR integration. Model selection also depends on the host. These capabilities are unsupported in hosts that lack them. Stop at the relevant gate and report the missing capability. Slash-command spellings depend on the host's skill UI. The `plan` handoff also describes `exec` as unavailable, although the package includes it. This upstream instruction remains unchanged and needs runtime review.

## Clean Codex smoke test

Status: not run for this submission archive. Local ZIP tests and existing runtime installation evidence do not prove a clean Codex session can execute this package's workflow.

1. Use a fresh Codex profile and an empty disposable project, without the repository's existing hooks or project instructions. Install the extracted package through the current supported development installation flow described in the [testing guide](https://developers.openai.com/plugins/deploy/connect-chatgpt).
2. Confirm all packaged skills are discoverable. Start a new conversation, activate `using-vibekit`, and ask for the trigger row for `brainstorm`. Confirm the host reads the packaged resource and does not request `CLAUDE.md` or a mandatory `Skill` tool.
3. Ask Vibekit to plan a small coding change. Confirm the approval gate runs before any implementation. If the host supports fresh subagents and tool restrictions, continue through an approved plan, execution and verification in the disposable project. Otherwise record that limitation.
4. Start another clean conversation and confirm explicit activation works without startup hooks. Record the Codex version, profile setup, prompts, observed tool calls and results before claiming runtime support.

## Publisher and portal steps

1. Sign in to the [OpenAI developer dashboard](https://platform.openai.com/) with the publisher's account. Complete the developer identity verification required by the submission portal. Confirm that `rizukirr` is the intended listing developer name and select the verified identity. The repository cannot establish verification or account eligibility.
2. Confirm the `Developer Tools` category in the portal, which is authoritative. Check listing text, capability labels, icon rendering and the starter prompt. The bundled logo and composer icon use the same 128 by 128 SVG.
3. Publish the approved `PRIVACY.md` to the public `main` branch before using the configured [privacy policy URL](https://github.com/rizukirr/vibekit/blob/main/PRIVACY.md). The configured [support URL](https://github.com/rizukirr/vibekit/issues) uses the repository's public issue tracker. Building the ZIP does not publish the policy or clear the portal's accessibility warning. Open the policy URL without authentication, verify a successful response and the actual policy content, and then re-upload the rebuilt ZIP. Live accessibility remains unverified until that check succeeds. If GitHub is inaccessible to the portal, use an accessible policy host, update `submission/interface.json`, and rebuild the ZIP. Confirm any additional portal-requested URLs, rights, availability countries, declarations and reviewer access. Do not invent them. Skills-only schema validation does not require all four MCP listing URLs, and this package has no MCP review cases or fabricated credentials.
4. Upload the ZIP, review the portal's parsed metadata, address its validation and security findings, complete the required review fields and submit using the publisher's authorized account. Upload success alone does not establish approval. Consult the [submission error reference](https://developers.openai.com/plugins/deploy/submission-errors) for reported problems.
5. After approval, use the portal's Publish plugin action when the publisher is ready to release. For future versions, update the repository's version, regenerate installation artifacts, rebuild and inspect a new versioned ZIP, upload it as a version update and follow the portal's review and publication steps.
