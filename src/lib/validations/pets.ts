import { z } from 'zod';

/** A pet (#996): a name, a kind and a colour. */
export const createPetSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  kind: z.enum(['cat', 'dog', 'other']).default('other'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour must be #RRGGBB'),
});

export const updatePetSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  kind: z.enum(['cat', 'dog', 'other']).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
