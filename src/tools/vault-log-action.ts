import { z } from "zod";
import { appendRecord } from "../audit/audit-logger.js";

export const vaultLogActionInputSchema = z
  .object({
    action: z.string().min(1, "action is required"),
    tool_used: z.string().min(1, "tool_used is required"),
    target_path: z.string().optional(),
    details: z.string().optional(),
  })
  .strict();

export type VaultLogActionInput = z.infer<typeof vaultLogActionInputSchema>;

export type VaultLogActionOptions = {
  surface?: string | undefined;
};

/**
 * FR22: append one audit line via WriteGate (same six-field format as other mutators).
 */
export async function vaultLogAction(
  vaultRoot: string,
  input: VaultLogActionInput,
  options: VaultLogActionOptions = {},
): Promise<{ logged_at: string }> {
  const surface = options.surface ?? "unknown";
  const logged_at = new Date().toISOString();
  await appendRecord(vaultRoot, {
    action: input.action,
    tool: input.tool_used,
    surface,
    targetPath: input.target_path ?? "",
    payloadInput: input.details ?? "",
    isoUtc: logged_at,
  });
  return { logged_at };
}
