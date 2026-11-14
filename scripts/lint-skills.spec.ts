/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSkill, checkSkill } from './lint-skills.ts';

/**
 * One fixture exercising everything the parser has to cope with: all six spec
 * keys, a nested key, a quoted value, a colon inside a value, and a horizontal
 * rule in the body that must not be mistaken for the frontmatter terminator.
 */
const VALID = `---
name: my-skill
description: "Does a thing. Use when: you need a thing."
license: Apache-2.0
compatibility: claude-code
allowed-tools: [Read, Write]
metadata:
  version: 1.2.3
---

# My skill

Body text.

---

More body, after a horizontal rule.
`;

/** Parse a SKILL.md and return its lint errors. */
function check(text: string, dirName = 'my-skill'): string[] {
  const skill = parseSkill(text);
  assert.ok(skill, 'expected the frontmatter to parse');
  return checkSkill(skill, dirName);
}

/** VALID with one frontmatter line removed. */
const without = (key: string) => VALID.replace(new RegExp(`^${key}:.*\n`, 'm'), '');

test('a complete, valid SKILL.md parses fully and passes every check', () => {
  const skill = parseSkill(VALID);
  assert.ok(skill);

  assert.deepEqual(skill.top, {
    name: 'my-skill',
    description: 'Does a thing. Use when: you need a thing.',
    license: 'Apache-2.0',
    compatibility: 'claude-code',
    'allowed-tools': '[Read, Write]',
    metadata: '',
  });
  assert.deepEqual(skill.nested, { metadata: { version: '1.2.3' } });
  assert.ok(skill.body.includes('More body, after a horizontal rule.'));

  assert.deepEqual(checkSkill(skill, 'my-skill'), []);
});

test('missing description', () => {
  assert.deepEqual(check(without('description')), ['skills/my-skill/SKILL.md: missing description']);
});

test('missing name', () => {
  assert.deepEqual(check(without('name')), ['skills/my-skill/SKILL.md: missing name']);
});

test('name does not match the directory', () => {
  assert.deepEqual(check(VALID, 'other-dir'), [
    'skills/other-dir/SKILL.md: name "my-skill" does not match directory "other-dir"',
  ]);
});

test('name is not kebab-case', () => {
  assert.deepEqual(check(VALID.replace('my-skill', 'My_Skill'), 'My_Skill'), [
    'skills/My_Skill/SKILL.md: name "My_Skill" is not lowercase-kebab-case',
  ]);
});

test('unknown frontmatter key', () => {
  assert.deepEqual(check(VALID.replace('license:', 'author:')), [
    'skills/my-skill/SKILL.md: unknown frontmatter key "author"',
  ]);
});

test('metadata.version is not semver', () => {
  assert.deepEqual(check(VALID.replace('1.2.3', 'v1.2')), [
    'skills/my-skill/SKILL.md: metadata.version "v1.2" is not semver',
  ]);
});

test('body is too long', () => {
  const errors = check(VALID.replace('Body text.', 'line\n'.repeat(501)));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^skills\/my-skill\/SKILL\.md: body is \d+ lines, max 500$/);
});

test('no frontmatter at all', () => {
  assert.equal(parseSkill('# Just markdown\n'), null);
  assert.equal(parseSkill('---\nname: x\nnever closed\n'), null);
  assert.equal(parseSkill(''), null);
});
