export function extractHashtags(text: string | undefined | null): string[] {
  if (!text) return [];
  // Match # followed by word characters (letters, numbers, underscores)
  const regex = /#([\w_]+)/g;
  const matches = [...text.matchAll(regex)];
  
  // Normalize: lowercase, remove the '#', and deduplicate
  const uniqueHashtags = new Set(matches.map(m => m[1].toLowerCase()));
  return Array.from(uniqueHashtags);
}
