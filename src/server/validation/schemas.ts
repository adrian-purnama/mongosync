import { z } from "zod";

const objectIdLike = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z0-9-]+$/);

const mongoUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => /^mongodb(\+srv)?:\/\//i.test(value),
    "Mongo URL must start with mongodb:// or mongodb+srv://",
  );

export const organizationSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const connectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  mongoUrl: mongoUrlSchema,
  locked: z.boolean().default(false),
  organizationId: objectIdLike,
});

export const connectionUpdateSchema = connectionSchema.partial().extend({
  id: objectIdLike,
});

export const copyRequestSchema = z
  .object({
    organizationId: objectIdLike,
    sourceConnectionId: objectIdLike,
    targetConnectionId: objectIdLike,
    sourceDatabase: z.string().trim().min(1),
    targetDatabase: z.string().trim().min(1),
    sourceCollections: z.array(z.string().trim().min(1)).min(1),
    mode: z.enum(["override", "append", "new"]),
    newCollectionName: z.string().trim().min(1).optional(),
    filter: z.record(z.string(), z.unknown()).optional(),
    limit: z.number().int().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "new" && !value.newCollectionName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "New collection name is required for new copy mode.",
        path: ["newCollectionName"],
      });
    }
  });

export const exportRequestSchema = z.object({
  organizationId: objectIdLike,
  sourceConnectionId: objectIdLike,
  sourceDatabase: z.string().trim().min(1),
  sourceCollections: z.array(z.string().trim().min(1)).optional(),
});
