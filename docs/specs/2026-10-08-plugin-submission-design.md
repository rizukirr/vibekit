---
title: Plugin submission package
date: 2026-10-08
status: draft
---

# Plugin submission package: Design

## Problem

Vibekit's current Codex manifest declares lifecycle hooks and lacks directory listing metadata. OpenAI's public plugin submission flow currently excludes lifecycle hooks. A separate package must contain usable skills and their resources without relying on the existing installation's startup hook.

## Goals

- A documented, repeatable command produces a ZIP for the OpenAI plugin submission portal using the current Vibekit version and source skills.
- The ZIP contains a Codex manifest, directory listing metadata, icon assets, valid skills, and all local resources those skills reference.
- Archive validation rejects lifecycle hooks, missing declared assets, missing skill resources, and invalid required manifest or skill fields.
- Submission instructions explain developer verification, upload, automated findings, review, and publication using official documentation links.
- The package explains how users activate Vibekit without lifecycle hooks and does not claim automatic session startup has been demonstrated when it has not.
- Existing generation checks and relevant repository tests pass after the packaging changes.

## Non-goals

Publishing, submitting policy attestations, verifying the developer's identity, guaranteeing review approval, and unrelated skill behavior changes are outside this preparation task.

## Constraints

- Preserve existing installation packages and runtime behavior.
- Generate the submission package separately from the existing installation artifacts.
- Use existing dependencies or native tools before introducing a dependency.
- Exclude secrets, Git internals, lifecycle hooks, and unrelated development files from the archive.
- Preserve existing unrelated working tree changes, including the previously present docs files.
- Do not invent publisher details, public policy URLs, or reviewer credentials. Report any required information that the repository cannot supply.
- Verify current OpenAI submission metadata and asset requirements before implementation.

## Approach

The user approved a separate, repeatable submission package after considering a manually assembled ZIP. No simpler scope met the requirement, so the pushback step proceeded directly to approaches.

A packaging command reads the current configuration and skills, stages only the submission files, adds directory metadata and icon assets, and creates a ZIP. Existing generated installation manifests remain governed by the current generator. Submission-specific changes apply only to staged files or dedicated submission sources.

The packager validates its inputs and staged package before producing the archive. Validation failures report the affected path or field and return a failing exit status. Packaging must not damage an existing archive when validation fails.

Review the bundled skills for references to Claude-specific tools and startup assumptions. Adapt submission-only instructions where needed so the documented workflow can be followed in Codex without hooks. Include the trigger table and referenced resources inside the package. Clearly document manual activation and any runtime validation that cannot be performed locally.

Provide upload instructions alongside the artifact and list any account-owned information still required. Developer verification, attestations, and publication remain actions for the publisher in the portal.

## Alternatives considered

A manually assembled ZIP needs less tooling but requires repeating the same packaging and validation steps for every release. The user chose repeatable packaging.

Changing the shared installation package would reduce the number of package variants but could disrupt existing startup behavior. A separate submission output preserves the current installation paths.

## Testing

Exercise archive creation and inspect its actual entries and manifest. Verify hook exclusion, bundled skills and resources, listing metadata, and declared icon paths. Include meaningful rejection checks for malformed inputs or missing resources. Run the existing generator check and relevant repository tests. Record whether clean Codex execution was tested or remains unverified.

## Open questions

The portal may require publisher-owned information not present in the repository. Report any such missing fields rather than fabricating them. Required metadata and icon formats will be resolved against current official documentation during planning.
