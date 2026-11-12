/**
 * Incrementally extracts complete JSON objects from an LLM text stream.
 * It tolerates code fences, prose between objects, NDJSON and very long lines.
 */
export class JsonObjectStream {
  private buffer = '';

  push(chunk: string): unknown[] {
    this.buffer += chunk;
    return this.drain();
  }

  end(): unknown[] {
    const flushed = this.drain();
    // A final object might be missing its closing brace because the model was cut off.
    // It is intentionally not parsed; callers surface a clear incomplete-generation error.
    this.buffer = '';
    return flushed;
  }

  private drain(): unknown[] {
    const objects: unknown[] = [];

    while (this.buffer.length > 0) {
      const start = this.buffer.indexOf('{');
      if (start === -1) {
        this.buffer = '';
        break;
      }
      if (start > 0) this.buffer = this.buffer.slice(start);

      const end = findObjectEnd(this.buffer);
      if (end === -1) break;

      const raw = this.buffer.slice(0, end + 1);
      this.buffer = this.buffer.slice(end + 1);

      try {
        objects.push(JSON.parse(raw));
      } catch {
        // Skip malformed object and keep scanning; a later object may still be valid.
      }
    }

    return objects;
  }
}

/**
 * Returns the index of the closing brace for the first object, or -1 when the
 * object is not complete yet. Braces inside JSON strings are ignored.
 */
export function findObjectEnd(input: string): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}
