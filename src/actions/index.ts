import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import { RephraseSessions, RephraseVariants, and, db, eq } from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnedSession(sessionId: string, userId: string) {
  const [session] = await db
    .select()
    .from(RephraseSessions)
    .where(and(eq(RephraseSessions.id, sessionId), eq(RephraseSessions.userId, userId)));

  if (!session) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Rephrase session not found.",
    });
  }

  return session;
}

export const server = {
  createSession: defineAction({
    input: z.object({
      language: z.string().optional(),
      context: z.string().optional(),
      originalText: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [session] = await db
        .insert(RephraseSessions)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          language: input.language,
          context: input.context,
          originalText: input.originalText,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { session } };
    },
  }),

  updateSession: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        language: z.string().optional(),
        context: z.string().optional(),
        originalText: z.string().optional(),
      })
      .refine(
        (input) =>
          input.language !== undefined ||
          input.context !== undefined ||
          input.originalText !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSession(input.id, user.id);

      const [session] = await db
        .update(RephraseSessions)
        .set({
          ...(input.language !== undefined ? { language: input.language } : {}),
          ...(input.context !== undefined ? { context: input.context } : {}),
          ...(input.originalText !== undefined ? { originalText: input.originalText } : {}),
          updatedAt: new Date(),
        })
        .where(eq(RephraseSessions.id, input.id))
        .returning();

      return { success: true, data: { session } };
    },
  }),

  listSessions: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const sessions = await db
        .select()
        .from(RephraseSessions)
        .where(eq(RephraseSessions.userId, user.id));

      return { success: true, data: { items: sessions, total: sessions.length } };
    },
  }),

  createVariant: defineAction({
    input: z.object({
      sessionId: z.string().min(1),
      tone: z.string().optional(),
      complexity: z.string().optional(),
      variantLabel: z.string().optional(),
      content: z.string().min(1),
      isFavorite: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSession(input.sessionId, user.id);

      const [variant] = await db
        .insert(RephraseVariants)
        .values({
          id: crypto.randomUUID(),
          sessionId: input.sessionId,
          tone: input.tone,
          complexity: input.complexity,
          variantLabel: input.variantLabel,
          content: input.content,
          isFavorite: input.isFavorite ?? false,
          createdAt: new Date(),
        })
        .returning();

      return { success: true, data: { variant } };
    },
  }),

  updateVariant: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        sessionId: z.string().min(1),
        tone: z.string().optional(),
        complexity: z.string().optional(),
        variantLabel: z.string().optional(),
        content: z.string().optional(),
        isFavorite: z.boolean().optional(),
      })
      .refine(
        (input) =>
          input.tone !== undefined ||
          input.complexity !== undefined ||
          input.variantLabel !== undefined ||
          input.content !== undefined ||
          input.isFavorite !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSession(input.sessionId, user.id);

      const [existing] = await db
        .select()
        .from(RephraseVariants)
        .where(and(eq(RephraseVariants.id, input.id), eq(RephraseVariants.sessionId, input.sessionId)));

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Rephrase variant not found.",
        });
      }

      const [variant] = await db
        .update(RephraseVariants)
        .set({
          ...(input.tone !== undefined ? { tone: input.tone } : {}),
          ...(input.complexity !== undefined ? { complexity: input.complexity } : {}),
          ...(input.variantLabel !== undefined ? { variantLabel: input.variantLabel } : {}),
          ...(input.content !== undefined ? { content: input.content } : {}),
          ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
        })
        .where(eq(RephraseVariants.id, input.id))
        .returning();

      return { success: true, data: { variant } };
    },
  }),

  deleteVariant: defineAction({
    input: z.object({
      id: z.string().min(1),
      sessionId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSession(input.sessionId, user.id);

      const result = await db
        .delete(RephraseVariants)
        .where(and(eq(RephraseVariants.id, input.id), eq(RephraseVariants.sessionId, input.sessionId)));

      if (result.rowsAffected === 0) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Rephrase variant not found.",
        });
      }

      return { success: true };
    },
  }),

  listVariants: defineAction({
    input: z.object({
      sessionId: z.string().min(1),
      favoritesOnly: z.boolean().default(false),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedSession(input.sessionId, user.id);

      const filters = [eq(RephraseVariants.sessionId, input.sessionId)];
      if (input.favoritesOnly) {
        filters.push(eq(RephraseVariants.isFavorite, true));
      }

      const variants = await db.select().from(RephraseVariants).where(and(...filters));

      return { success: true, data: { items: variants, total: variants.length } };
    },
  }),
};
