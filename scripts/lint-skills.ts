import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** A SKILL.md split into its frontmatter keys and the markdown that follows. */
interface SkillDoc {
  /** Frontmatter keys at column 0. */
  top: Record<string, string>;
  /** Indented frontmatter keys, grouped under the top-level key above them. */
  nested: Record<string, Record<string, string>>;
  /** Everything after the closing `---`. */
  body: string;
}

// shortcut: shallow YAML — no anchors, block scalars or nested lists; upgrade to the yaml package if a skill needs them.
function parseSkillDoc(text: string): SkillDoc | null {
  const lines = text.split('\n');
  if (lines[0] !== '---') return null;

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) return null;

  const top: Record<string, string> = {};
  const nested: Record<string, Record<string, string>> = {};
  let currentKey = '';

  for (let i = 1; i < endIdx; i++) {
    const line = lines[i];
    const topMatch = line.match(/^([a-z][a-z0-9-]*):\s*(.*)$/);
    const nestedMatch = line.match(/^\s+([a-z][a-z0-9-]*):\s*(.*)$/);

    if (topMatch) {
      currentKey = topMatch[1];
      let value = topMatch[2];
      value = value.replace(/^["']|["']$/g, '');
      top[currentKey] = value;
    } else if (nestedMatch && currentKey) {
      if (!nested[currentKey]) nested[currentKey] = {};
      let value = nestedMatch[2];
      value = value.replace(/^["']|["']$/g, '');
      nested[currentKey][nestedMatch[1]] = value;
    }
  }

  const body = lines.slice(endIdx + 1).join('\n');
  return { top, nested, body };
}

function lintSkill(skillDir: string, skillName: string): string[] {
  const errors: string[] = [];
  const skillPath = resolve(skillDir);
  const skillMdPath = resolve(skillPath, 'SKILL.md');

  if (!existsSync(skillMdPath)) {
    errors.push(`skills/${skillName}: missing SKILL.md`);
    return errors;
  }

  const content = readFileSync(skillMdPath, 'utf-8');
  const doc = parseSkillDoc(content);

  if (!doc) {
    errors.push(`skills/${skillName}/SKILL.md: missing YAML frontmatter`);
    return errors;
  }

  const validTopKeys = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];
  for (const key of Object.keys(doc.top)) {
    if (!validTopKeys.includes(key)) {
      errors.push(`skills/${skillName}/SKILL.md: unknown frontmatter key "${key}"`);
    }
  }

  const name = doc.top['name'];
  if (!name) {
    errors.push(`skills/${skillName}/SKILL.md: missing name`);
  } else {
    if (name !== skillName) {
      errors.push(`skills/${skillName}/SKILL.md: name "${name}" does not match directory "${skillName}"`);
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
      errors.push(`skills/${skillName}/SKILL.md: name "${name}" is not lowercase-kebab-case`);
    }
    if (name.length > 64) {
      errors.push(`skills/${skillName}/SKILL.md: name is ${name.length} chars, max 64`);
    }
  }

  const description = doc.top['description'];
  if (!description || description.trim().length === 0) {
    errors.push(`skills/${skillName}/SKILL.md: missing description`);
  } else if (description.length > 1024) {
    errors.push(`skills/${skillName}/SKILL.md: description is ${description.length} chars, max 1024`);
  }

  const version = doc.nested['metadata']?.['version'];
  if (version && !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.test(version)) {
    errors.push(`skills/${skillName}/SKILL.md: metadata.version "${version}" is not semver`);
  }

  const bodyLines = doc.body.trimStart().split('\n');
  if (bodyLines.length > 500) {
    errors.push(`skills/${skillName}/SKILL.md: body is ${bodyLines.length} lines, max 500`);
  }

  // shortcut: inline links only, no [text][ref] reference style; add if a skill starts using it.
  const linkRegex = /\]\(([^)\s]+)/g;
  let match;
  while ((match = linkRegex.exec(doc.body)) !== null) {
    let target = match[1];
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('mailto:') || target.startsWith('#')) {
      continue;
    }
    target = target.split('#')[0].split('?')[0];
    if (!target) continue;
    const resolved = resolve(skillPath, target);
    if (!existsSync(resolved)) {
      errors.push(`skills/${skillName}/SKILL.md: broken link: ${match[1]}`);
    }
  }

  return errors;
}

try {
  const skillsDir = resolve(process.cwd(), 'skills');
  if (!existsSync(skillsDir)) {
    process.exit(0);
  }

  const entries = readdirSync(skillsDir, { withFileTypes: true });
  const allErrors: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillPath = resolve(skillsDir, entry.name);
      const errors = lintSkill(skillPath, entry.name);
      allErrors.push(...errors);
    }
  }

  if (allErrors.length > 0) {
    for (const error of allErrors) {
      console.error(error);
    }
    process.exitCode = 1;
  }
} catch (err) {
  console.error('Linter error:', err);
  process.exitCode = 1;
}
