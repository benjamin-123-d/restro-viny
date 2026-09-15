/**
 * Folds a label for typing-as-you-search: case, accents and punctuation do not
 * matter, so « creme fraiche » finds « Crème fraîche ».
 */
export const foldText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Every typed word must appear somewhere in the label, in any order. */
export const matchesSearch = (label: string, query: string): boolean => {
  const words = foldText(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const folded = foldText(label);
  return words.every((word) => folded.includes(word));
};

/** Options sorted so labels starting with the query come first. */
export const rankMatches = <T extends { readonly label: string }>(options: readonly T[], query: string): T[] => {
  const q = foldText(query);
  return options
    .filter((option) => matchesSearch(option.label, query))
    .sort((a, b) => Number(foldText(b.label).startsWith(q)) - Number(foldText(a.label).startsWith(q)));
};

/** True when the query names an existing label exactly (accents aside). */
export const hasExactMatch = (options: readonly { readonly label: string }[], query: string): boolean => {
  const q = foldText(query);
  return q.length > 0 && options.some((option) => foldText(option.label) === q);
};
