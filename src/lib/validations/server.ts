import { z } from "zod";

export const serverSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  host: z.string().trim().min(1, "Host is required").max(255),
  port: z.coerce.number().int().min(1).max(65535).default(22),
  username: z.string().trim().min(1, "Username is required").max(100),
  remark: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((value) => value || null),
});

export type ServerInput = z.infer<typeof serverSchema>;
