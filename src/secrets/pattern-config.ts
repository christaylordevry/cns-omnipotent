import { z } from "zod";

export const secretPatternsFileSchema = z.object({
  patterns: z.array(
    z.object({
      id: z.string().min(1),
      regex: z.string().min(1),
    }),
  ),
});

export type SecretPatternsFile = z.infer<typeof secretPatternsFileSchema>;

export type CompiledSecretPattern = {
  id: string;
  regex: RegExp;
};
