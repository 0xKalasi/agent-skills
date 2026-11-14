---
name: conventional-commits
description: Write commit messages in Conventional Commits format. Use when committing changes, writing a commit message, amending a commit, or when the user asks how to phrase one.
license: Apache-2.0
metadata:
  version: 0.1.0
---

# Conventional Commits

Format every commit subject as `<type>(<scope>): <description>`.

The scope is optional. The description is lowercase, imperative mood ("add", not
"added" or "adds"), and has no trailing period. Keep the subject under 72
characters.

## Types

| Type | Use for |
| --- | --- |
| `feat` | a new capability for users |
| `fix` | a bug fix |
| `docs` | documentation only |
| `refactor` | behaviour-preserving code change |
| `test` | adding or correcting tests |
| `build` | build system, dependencies, packaging |
| `ci` | CI configuration and workflows |
| `chore` | anything else that touches no source behaviour |

## Breaking changes

Mark them with `!` before the colon, and explain the break in the body:

```
feat(api)!: drop support for v1 tokens

v1 tokens are rejected with 401. Migrate with `auth migrate --to v2`.
```

## Body and footers

Add a body when the subject cannot carry the "why". Wrap at 72 columns and
separate it from the subject with a blank line. Reference issues in footers:
`Refs: #123` or `Closes: #123`.

See [examples.md](examples.md) for complete messages.

## Checklist

1. Pick the narrowest type that fits — if a commit needs two types, it should
   probably be two commits.
2. Say what changed and why, not how; the diff already shows how.
3. Do not invent a scope that does not map to a directory or component in the
   repository.
