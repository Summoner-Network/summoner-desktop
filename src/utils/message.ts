export type TypedValue = { value: unknown; type: unknown };

function normalizePythonJsonish(text: string): string {
  let out = "";
  let i = 0;
  let inString = false;
  let stringQuote: "'" | "\"" | null = null;
  let escape = false;

  function prevNonSpace(idx: number): string | null {
    for (let j = idx - 1; j >= 0; j -= 1) {
      const c = text[j];
      if (!/\s/.test(c)) return c;
    }
    return null;
  }

  function nextNonSpace(idx: number): string | null {
    for (let j = idx; j < text.length; j += 1) {
      const c = text[j];
      if (!/\s/.test(c)) return c;
    }
    return null;
  }

  while (i < text.length) {
    const ch = text[i];

    if (inString) {
      if (ch === stringQuote && !escape) {
        inString = false;
        stringQuote = null;
        out += "\"";
      } else {
        out += ch === "\"" && stringQuote === "'" ? "\\\"" : ch;
      }

      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      }

      i += 1;
      continue;
    }

    if (ch === "\"" || ch === "'") {
      inString = true;
      stringQuote = ch as "'" | "\"";
      out += "\"";
      i += 1;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      const prev = prevNonSpace(i);
      if (prev === "{" || prev === ",") {
        let j = i + 1;
        while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j += 1;
        const next = nextNonSpace(j);
        if (next === ":") {
          const key = text.slice(i, j);
          out += `"${key}"`;
          i = j;
          continue;
        }
      }
    }

    if (text.startsWith("None", i)) {
      out += "null";
      i += 4;
      continue;
    }
    if (text.startsWith("True", i)) {
      out += "true";
      i += 4;
      continue;
    }
    if (text.startsWith("False", i)) {
      out += "false";
      i += 5;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

export function safeParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(normalizePythonJsonish(text));
    } catch {
      return null;
    }
  }
}

export function castWithTypes(val: unknown, expected: unknown): unknown {
  if (expected === null || expected === undefined) return val;
  if (expected === "str") return String(val);
  if (expected === "bool") return Boolean(val);
  if (expected === "int") {
    const n = Number(val);
    return Number.isFinite(n) ? Math.trunc(n) : val;
  }
  if (expected === "float") {
    const n = Number(val);
    return Number.isFinite(n) ? n : val;
  }
  if (expected === "null") return null;

  if (Array.isArray(expected) && Array.isArray(val)) {
    return val.map((item, i) => (i < expected.length ? castWithTypes(item, expected[i]) : item));
  }

  if (expected && typeof expected === "object" && val && typeof val === "object" && !Array.isArray(val)) {
    const out: Record<string, unknown> = {};
    const exp = expected as Record<string, unknown>;
    const v = val as Record<string, unknown>;
    Object.keys(exp).forEach((k) => {
      if (k in v) out[k] = castWithTypes(v[k], exp[k]);
    });
    Object.keys(v).forEach((k) => {
      if (!(k in exp)) out[k] = v[k];
    });
    return out;
  }

  return val;
}

export function inferType(val: unknown): unknown {
  if (val === null) return "null";
  if (typeof val === "string") return "str";
  if (typeof val === "boolean") return "bool";
  if (typeof val === "number") return Number.isInteger(val) ? "int" : "float";
  if (Array.isArray(val)) return val.map((v) => inferType(v));
  if (val && typeof val === "object") {
    const out: Record<string, unknown> = {};
    Object.entries(val as Record<string, unknown>).forEach(([k, v]) => {
      out[k] = inferType(v);
    });
    return out;
  }
  return "str";
}

export function formatValue(val: unknown): string {
  if (typeof val === "string") return val;
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

export type ParsedMessage = {
  text: string;
  remoteAddr?: string;
  typed?: TypedValue;
  content?: unknown;
};

export function parseServerMessage(raw: string): ParsedMessage {
  const outer = safeParseJson(raw);
  if (!outer || typeof outer !== "object" || Array.isArray(outer)) {
    return { text: raw };
  }

  const outerObj = outer as Record<string, unknown>;
  if (!("remote_addr" in outerObj) || !("content" in outerObj)) {
    return { text: formatValue(outer), typed: { value: outer, type: inferType(outer) }, content: outer };
  }

  const remoteAddr = typeof outerObj.remote_addr === "string" ? outerObj.remote_addr : undefined;
  let content: unknown = outerObj.content;

  if (typeof content === "string") {
    const parsed = safeParseJson(content);
    if (parsed !== null) content = parsed;
  }

  if (
    content &&
    typeof content === "object" &&
    !Array.isArray(content) &&
    "_payload" in (content as Record<string, unknown>) &&
    "_type" in (content as Record<string, unknown>)
  ) {
    const env = content as Record<string, unknown>;
    const payload = castWithTypes(env._payload, env._type);
    return {
      text: formatValue(payload),
      remoteAddr,
      typed: { value: payload, type: env._type },
      content: payload
    };
  }

  return { text: formatValue(content), remoteAddr, typed: { value: content, type: inferType(content) }, content };
}
