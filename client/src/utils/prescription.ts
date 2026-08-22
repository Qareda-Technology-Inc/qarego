export const MAX_PRESCRIPTION_PHOTOS = 3;

const POM_RE = /prescription|\(POM\)|\bPOM\b|\brx\b/i;

export function isPomMenuItem(item?: {
  category?: string | null;
  name?: string | null;
  tags?: string[] | null;
} | null): boolean {
  if (!item) return false;
  const tags = Array.isArray(item.tags) ? item.tags.join(" ") : "";
  const hay = `${item.category || ""} ${item.name || ""} ${tags}`;
  return POM_RE.test(hay);
}
