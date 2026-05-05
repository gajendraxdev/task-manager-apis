import { slugify } from "./slugify.ts";

/**
 * Generates a URL-safe slug from `text` and ensures it's unique
 * by calling `isExisting(slug)`. If taken, appends a random number
 * and retries until a free slug is found.
 */
export const generateUniqueSlug = async (
  text: string,
  isExisting: (slug: string) => Promise<boolean>,
): Promise<string> => {
  let slug = slugify(text);

  while (await isExisting(slug)) {
    slug = `${slugify(text)}-${Math.floor(Math.random() * 9000) + 1000}`;
  }

  return slug;
};
