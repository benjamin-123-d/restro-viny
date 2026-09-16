/**
 * Turning scattered pieces of text back into lines.
 *
 * A PDF invoice and a photographed ticket have the same trap: the words come
 * out in the order the file happens to store them, not in the order they are
 * printed. On a columned invoice the label lands far from its amount, and any
 * rule of the shape « label … amount at the end of the line » finds nothing.
 *
 * Both sources do say *where* each piece of text sits. Same height means same
 * line; left to right gives the order. That is all this does.
 */

export interface TextCell {
  /** Distance from the left edge, in whatever unit the source uses. */
  readonly x: number;
  /** Distance from the top of the page, growing downwards. */
  readonly y: number;
  readonly text: string;
  /** Page number, so two pages never share a line. */
  readonly page?: number;
}

export interface TextRow {
  readonly page: number;
  readonly y: number;
  readonly cells: readonly string[];
  /** The row as one string, cells separated by two spaces. */
  readonly text: string;
}

/** Half the height of a line of text: anything closer belongs to the same row. */
export const DEFAULT_TOLERANCE = 4;

/**
 * Groups cells into rows by their height, then reads each row left to right.
 * Cells that overlap horizontally (a wrapped label, say) keep their order.
 */
export const rowsFromCells = (cells: readonly TextCell[], tolerance = DEFAULT_TOLERANCE): TextRow[] => {
  const kept = cells.filter((cell) => cell.text.trim() !== "");
  if (kept.length === 0) return [];

  const sorted = [...kept].sort(
    (a, b) => (a.page ?? 0) - (b.page ?? 0) || a.y - b.y || a.x - b.x,
  );

  const rows: { page: number; y: number; cells: TextCell[] }[] = [];
  for (const cell of sorted) {
    const page = cell.page ?? 0;
    const last = rows[rows.length - 1];
    if (last && last.page === page && Math.abs(cell.y - last.y) <= tolerance) {
      last.cells.push(cell);
      // The row's height follows its first cell, so a long row cannot drift.
      continue;
    }
    rows.push({ page, y: cell.y, cells: [cell] });
  }

  return rows.map((row) => {
    const cellTexts = [...row.cells]
      .sort((a, b) => a.x - b.x)
      .map((cell) => cell.text.trim())
      .filter(Boolean);
    return { page: row.page, y: row.y, cells: cellTexts, text: cellTexts.join("  ") };
  });
};

/** The rows as plain text, one line each — what the parser reads. */
export const rowsToText = (rows: readonly TextRow[]): string => rows.map((row) => row.text).join("\n");

/**
 * Words that a photo's OCR gives back, with their boxes, turned into cells.
 * Tesseract measures from the top-left corner in pixels, exactly what we want.
 */
export const cellsFromWords = (
  words: readonly { readonly text: string; readonly bbox: { readonly x0: number; readonly y0: number; readonly y1: number } }[],
): TextCell[] =>
  words.map((word) => ({
    x: word.bbox.x0,
    // The middle of the word, so a taller word does not start a row of its own.
    y: (word.bbox.y0 + word.bbox.y1) / 2,
    text: word.text,
  }));

/**
 * Text items that a PDF gives back. pdf.js reports positions from the *bottom*
 * of the page, so they are flipped: on screen, lower on the page must mean a
 * later row.
 */
export const cellsFromPdfItems = (
  items: readonly { readonly str: string; readonly transform: readonly number[] }[],
  page: number,
  pageHeight: number,
): TextCell[] =>
  items.map((item) => ({
    x: item.transform[4] ?? 0,
    y: pageHeight - (item.transform[5] ?? 0),
    text: item.str,
    page,
  }));
