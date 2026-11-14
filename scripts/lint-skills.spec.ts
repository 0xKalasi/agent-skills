import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSkill } from './lint-skills.ts';

const VALID = `---
name: my-skill
description: Does a thing.
metadata:
  version: 1.2.3
---

# Heading

Body text.
`;

test('splits frontmatter from body', () => {
  const skill = parseSkill(VALID);
  assert.ok(skill);
  assert.equal(skill.top['name'], 'my-skill');
  assert.equal(skill.top['description'], 'Does a thing.');
  assert.equal(skill.body.trimStart(), '# Heading\n\nBody text.\n');
});

test('files indented keys under the top-level key above them', () => {
  const skill = parseSkill(VALID);
  assert.equal(skill?.nested['metadata']?.['version'], '1.2.3');
  // metadata is also a top-level key, with an empty value — that is what lets the
  // spec-key check see it without the semver check tripping over it.
  assert.equal(skill?.top['metadata'], '');
});

test('returns null when frontmatter is missing or unterminated', () => {
  assert.equal(parseSkill('# Just markdown\n'), null);
  assert.equal(parseSkill('---\nname: x\nnever closed\n'), null);
  assert.equal(parseSkill(''), null);
});

test('a body horizontal rule does not end the frontmatter early', () => {
  const skill = parseSkill('---\nname: x\n---\n\nintro\n\n---\n\nmore\n');
  assert.equal(skill?.top['name'], 'x');
  assert.ok(skill?.body.includes('more'));
});

test('strips only balanced surrounding quotes', () => {
  const skill = parseSkill(`---
a: "quoted"
b: 'single'
c: it's fine
---
`);
  assert.equal(skill?.top['a'], 'quoted');
  assert.equal(skill?.top['b'], 'single');
  assert.equal(skill?.top['c'], "it's fine");
});

test('ignores list items and blank lines rather than inventing keys', () => {
  const skill = parseSkill('---\nname: x\nallowed-tools:\n  - Read\n  - Write\n\n---\n');
  assert.deepEqual(Object.keys(skill?.top ?? {}), ['name', 'allowed-tools']);
  assert.equal(skill?.nested['allowed-tools'], undefined);
});

test('a colon in a value does not split the value', () => {
  const skill = parseSkill('---\ndescription: Use when: committing.\n---\n');
  assert.equal(skill?.top['description'], 'Use when: committing.');
});
