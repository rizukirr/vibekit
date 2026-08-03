---
name: example-plain
description: Fixture skill that exercises the plain-skill path.
trigger: Never — this is a build fixture
gate: hard
---

# example-plain

Build fixture. Proves the common case: a skill that appears in the trigger table
and emits no command file. Uses `gate: hard` so the Gate column has a non-default
value to render. Deleted once the real pipeline is authored.
