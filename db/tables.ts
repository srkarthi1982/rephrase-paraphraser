/**
 * Rephrase & Paraphraser - rewrite text with different clarity and style levels.
 *
 * Design goals:
 * - Capture rephrase sessions per input text.
 * - Store multiple variants with tone / complexity flags.
 * - Can later be connected to other apps (blog, email, etc.) if needed.
 */

import { defineTable, column, NOW } from "astro:db";

export const RephraseSessions = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    language: column.text({ optional: true }),        // target language for paraphrase
    context: column.text({ optional: true }),         // "academic", "blog", "casual chat"
    originalText: column.text(),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const RephraseVariants = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    sessionId: column.text({
      references: () => RephraseSessions.columns.id,
    }),
    tone: column.text({ optional: true }),            // "formal", "simple", "friendly"
    complexity: column.text({ optional: true }),      // "basic", "intermediate", "advanced"
    variantLabel: column.text({ optional: true }),    // "A", "B", "Short version"
    content: column.text(),                           // paraphrased text
    isFavorite: column.boolean({ default: false }),
    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  RephraseSessions,
  RephraseVariants,
} as const;
