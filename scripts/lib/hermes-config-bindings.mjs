/**
 * Parse Hermes `discord.channel_skill_bindings` list form (- id + skills: array).
 * Does not use a YAML parser — line/state only.
 */

/**
 * @param {string} configText
 * @returns {{ id: string, skills: string[] }[]}
 */
export function parseChannelSkillBindings(configText) {
  const lines = configText.split(/\r?\n/);
  let startIdx = -1;
  let sectionIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)channel_skill_bindings\s*:\s*$/);
    if (m) {
      startIdx = i + 1;
      sectionIndent = m[1].length;
      break;
    }
  }

  if (startIdx < 0) return [];

  /** @type {{ id: string, skills: string[] }[]} */
  const bindings = [];
  /** @type {{ id: string, skills: string[] } | null} */
  let current = null;
  let inSkills = false;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue;

    const indent = line.match(/^(\s*)/)[1].length;
    if (indent <= sectionIndent && /^\s*[\w-]+\s*:/.test(line)) {
      break;
    }

    const idM = line.match(/^\s*-\s+id\s*:\s*(.+)$/);
    if (idM) {
      if (current) bindings.push(current);
      let id = idM[1].trim();
      id = id.replace(/^['"]|['"]$/g, "");
      current = { id, skills: [] };
      inSkills = false;
      continue;
    }

    if (/^\s*skills\s*:\s*$/.test(line) && current) {
      inSkills = true;
      continue;
    }

    if (inSkills && current) {
      const skillM = line.match(/^\s+-\s+(.+?)\s*$/);
      if (skillM) {
        let name = skillM[1].trim();
        name = name.replace(/^['"]|['"]$/g, "");
        current.skills.push(name);
      }
    }
  }

  if (current) bindings.push(current);
  return bindings;
}

/**
 * @param {{ id: string, skills: string[] }[]} bindings
 * @returns {{ skill: string, channelId: string }[]}
 */
export function flattenBoundSkills(bindings) {
  /** @type {{ skill: string, channelId: string }[]} */
  const out = [];
  for (const b of bindings) {
    for (const skill of b.skills) {
      out.push({ skill, channelId: b.id });
    }
  }
  return out;
}
