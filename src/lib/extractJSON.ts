/**
 * Safely extract and parse a JSON value from model output.
 * Handles markdown code fences, leading/trailing text, and truncation.
 */

function extractBetween(text: string, open: string, close: string): string | null {
  const start = text.indexOf(open);
  if (start === -1) return null;
  const end = text.lastIndexOf(close);
  if (end === -1 || end <= start) return null;
  return text.slice(start, end + close.length);
}

/** Extract and parse a JSON array from raw model text. */
export function extractArray<T>(text: string): T[] {
  const slice = extractBetween(text, "[", "]");
  if (!slice) throw new Error("No JSON array found in model output.");
  try {
    return JSON.parse(slice) as T[];
  } catch {
    // Truncation recovery: find last complete object and close the array
    const lastComma = slice.lastIndexOf("},");
    if (lastComma === -1) throw new Error("Could not parse JSON array.");
    return JSON.parse(slice.slice(0, lastComma + 1) + "]") as T[];
  }
}

/** Extract and parse a JSON object from raw model text. */
export function extractObject<T>(text: string): T {
  const slice = extractBetween(text, "{", "}");
  if (!slice) throw new Error("No JSON object found in model output.");
  return JSON.parse(slice) as T;
}
