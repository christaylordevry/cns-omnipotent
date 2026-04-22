import { z } from "zod";

export const operatorTrackSchema = z.object({
  name: z.string().min(1),
  status: z.string().min(1),
  priority: z.enum(["primary", "secondary"]),
});

export const operatorContextSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  positioning: z.string().min(1),
  tracks: z.array(operatorTrackSchema),
  constraints: z.array(z.string()),
  vault_profile_note: z.string().optional(),
});

export type OperatorTrack = z.infer<typeof operatorTrackSchema>;
export type OperatorContext = z.infer<typeof operatorContextSchema>;

export const DEFAULT_OPERATOR_CONTEXT: OperatorContext = {
  name: "Chris Taylor",
  location: "Sydney, Australia",
  positioning: "Creative Technologist",
  tracks: [
    { name: "Escape Job", status: "active", priority: "primary" },
    { name: "Build Agency", status: "active", priority: "primary" },
  ],
  constraints: ["solo operator", "building in public"],
};
