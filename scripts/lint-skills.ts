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

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { valid } from 'semver';

/** Frontmatter keys the skill spec allows. Anything else is a typo or an invention. */
const SPEC_KEYS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];

const MAX_NAME = 64;
const MAX_DESCRIPTION = 1024;
const MAX_BODY_LINES = 500;

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

const INLINE_LINK = /\]\(([^)\s]+)/g;

export interface Skill {
  frontmatter: Record<string, unknown>;
  body: string;
}

/** Returns null when there is no usable frontmatter block. Throws on malformed YAML. */
export function parseSkill(text: string): Skill | null {
  const match = text.match(FRONTMATTER);
  if (!match) return null;

  const frontmatter = parse(match[1]);
  if (typeof frontmatter !== 'object' || frontmatter === null || Array.isArray(frontmatter)) return null;

  return { frontmatter, body: text.slice(match[0].length) };
}

const label = (skillName: string) => (msg: string) => `skills/${skillName}/SKILL.md: ${msg}`;

/** Every rule that can be judged from the file's text alone. Link resolution needs the disk, so it lives in lintSkill. */
export function checkSkill(skill: Skill, skillName: string): string[] {
  const errors: string[] = [];
  const prefix = label(skillName);
  const err = (msg: string) => errors.push(prefix(msg));

  for (const key of Object.keys(skill.frontmatter)) {
    if (!SPEC_KEYS.includes(key)) err(`unknown frontmatter key "${key}"`);
  }

  const name = skill.frontmatter['name'];
  if (typeof name !== 'string' || name.length === 0) {
    err('missing name');
  } else {
    if (name !== skillName) err(`name "${name}" does not match directory "${skillName}"`);
    if (!KEBAB_CASE.test(name)) err(`name "${name}" is not lowercase-kebab-case`);
    if (name.length > MAX_NAME) err(`name is ${name.length} chars, max ${MAX_NAME}`);
  }

  const description = skill.frontmatter['description'];
  if (typeof description !== 'string' || description.trim().length === 0) {
    err('missing description');
  } else if (description.length > MAX_DESCRIPTION) {
    err(`description is ${description.length} chars, max ${MAX_DESCRIPTION}`);
  }

  // `valid()` normalizes (" v1.2.3" -> "1.2.3"), so compare to the input to stay strict.
  // The typeof guard matters because YAML reads `version: 1.0` as the number 1.
  const version = (skill.frontmatter['metadata'] as Record<string, unknown> | undefined)?.['version'];
  if (version !== undefined && (typeof version !== 'string' || valid(version) !== version)) {
    err(`metadata.version "${version}" is not semver`);
  }

  const bodyLines = skill.body.trimStart().split('\n').length;
  if (bodyLines > MAX_BODY_LINES) err(`body is ${bodyLines} lines, max ${MAX_BODY_LINES}`);

  return errors;
}

/** Lints one skill directory. `skillPath` must already be absolute. */
export function lintSkill(skillPath: string, skillName: string): string[] {
  const prefix = label(skillName);

  const skillMdPath = resolve(skillPath, 'SKILL.md');
  if (!existsSync(skillMdPath)) return [`skills/${skillName}: missing SKILL.md`];

  let skill: Skill | null;
  try {
    skill = parseSkill(readFileSync(skillMdPath, 'utf-8'));
  } catch (error) {
    return [prefix(`invalid YAML frontmatter: ${error instanceof Error ? error.message : error}`)];
  }
  if (!skill) return [prefix('missing YAML frontmatter')];

  const errors = checkSkill(skill, skillName);

  // shortcut: inline links only, no [text][ref] reference style; add if a skill starts using it.
  for (const [, target] of skill.body.matchAll(INLINE_LINK)) {
    if (/^(https?:\/\/|mailto:|#)/.test(target)) continue;
    const path = target.split(/[#?]/)[0];
    if (path && !existsSync(resolve(skillPath, path))) errors.push(prefix(`broken link: ${target}`));
  }

  return errors;
}

function main(): void {
  const skillsDir = resolve(process.cwd(), 'skills');
  if (!existsSync(skillsDir)) {
    console.error('no skills/ directory');
    process.exitCode = 1;
    return;
  }

  const errors = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => lintSkill(resolve(skillsDir, entry.name), entry.name));

  for (const error of errors) console.error(error);
  if (errors.length > 0) process.exitCode = 1;
}

// Only lint when run directly, so the test can import parseSkill without side effects.
if (process.argv[1] === import.meta.filename) main();
