# Examples

A plain fix:

```
fix(parser): handle empty frontmatter block
```

A feature with a body explaining the why:

```
feat(lint): check that relative links resolve

Broken links in a SKILL.md only surface once an agent follows one, which
is far too late. Resolving them at lint time costs nothing.
```

A breaking change:

```
feat(cli)!: require --scope on every install

Implicit project scope surprised people running the CLI from a home
directory. Pass --scope project to keep the old behaviour.

Refs: #214
```

Splitting a mixed change into two commits:

```
refactor(store): extract retry helper
fix(store): retry on 503 as well as 502
```
