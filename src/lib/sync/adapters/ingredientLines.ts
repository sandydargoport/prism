/**
 * Prism keeps a recipe's ingredients as plain lines ({text} or {heading}) and
 * its steps as one block of text; Tandoor and Mealie keep structured objects
 * (#1215). These helpers line up Prism's lines with the source's, as a pull
 * would render them, so a line that did not change keeps its object (food,
 * unit, amount and their links) and only new or edited lines go as notes.
 */

export interface IngredientLine {
  text?: string;
  heading?: string;
}

/** A line's identity for matching: headings and text never match each other. */
export function lineKey(line: IngredientLine): string {
  return line.heading ? `h:${line.heading.trim()}` : `t:${(line.text ?? '').trim()}`;
}

export function sameLines(a: IngredientLine[], b: IngredientLine[]): boolean {
  return a.length === b.length && a.every((line, i) => lineKey(line) === lineKey(b[i]!));
}

/**
 * For each local line, the index of the remote line it keeps (same text, each
 * remote line used once, earliest first), or null for a line that is new or
 * was edited. Remote lines left unmatched were removed in Prism.
 */
export function matchLines(local: IngredientLine[], remote: IngredientLine[]): Array<number | null> {
  const free = new Map<string, number[]>();
  remote.forEach((line, i) => {
    const k = lineKey(line);
    free.set(k, [...(free.get(k) ?? []), i]);
  });
  return local.map((line) => free.get(lineKey(line))?.shift() ?? null);
}

/** Lines that will go to the source as plain notes (new or edited text lines). */
export function plainLineCount(local: IngredientLine[], remote: IngredientLine[]): number {
  return matchLines(local, remote).filter((m, i) => m === null && !local[i]!.heading).length;
}

/** Normalised instructions for comparing Prism's block with the source's. */
export function sameInstructions(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (s: string | null | undefined) => (s ?? '').replace(/\r\n/g, '\n').trim();
  return norm(a) === norm(b);
}

/**
 * What a recipe push will do with ingredients and steps, for the review.
 * Empty when neither changed.
 */
export function describeRecipePush(
  local: { ingredients: IngredientLine[]; instructions: string | null },
  remote: { ingredients: IngredientLine[]; instructions: string | null; stepCount: number },
  remoteName: string,
): string[] {
  const out: string[] = [];
  if (!sameLines(local.ingredients, remote.ingredients)) {
    const plain = plainLineCount(local.ingredients, remote.ingredients);
    out.push(plain === 0
      ? 'ingredients reordered or removed'
      : `${plain} ingredient line${plain === 1 ? '' : 's'} go${plain === 1 ? 'es' : ''} as plain notes`);
  }
  if (!sameInstructions(local.instructions, remote.instructions)) {
    out.push(remote.stepCount > 1
      ? `the steps stay as they are in ${remoteName}, which has ${remote.stepCount}`
      : 'steps sent');
  }
  return out;
}
