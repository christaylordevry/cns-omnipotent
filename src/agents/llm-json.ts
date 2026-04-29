type JsonParseResult = { ok: true; value: unknown } | { ok: false };

function tryParseJson(text: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function extractFencedJson(text: string): string | undefined {
  const match = text.match(/```(?:json|JSON|[\w-]+)?\s*\n([\s\S]*?)\n?```/);
  return match?.[1]?.trim();
}

function extractFirstJsonObject(text: string): string | undefined {
  const start = text.indexOf("{");
  if (start < 0) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1).trim();
    }
  }

  return undefined;
}

export function parseLlmJsonText(text: string): unknown {
  const trimmed = text.trim();
  const direct = tryParseJson(trimmed);
  if (direct.ok) return direct.value;

  const fenced = extractFencedJson(trimmed);
  if (fenced !== undefined) {
    const parsedFence = tryParseJson(fenced);
    if (parsedFence.ok) return parsedFence.value;
  }

  const objectCandidate = extractFirstJsonObject(trimmed);
  if (objectCandidate !== undefined) {
    const parsedObject = tryParseJson(objectCandidate);
    if (parsedObject.ok) return parsedObject.value;
  }

  return JSON.parse(trimmed);
}
