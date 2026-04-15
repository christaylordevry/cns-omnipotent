import type { PakeType } from "../pake/schemas.js";

export type PakeStatus = "draft" | "in-progress" | "reviewed" | "archived";
export type PakeVerificationStatus = "pending" | "verified" | "disputed";

export type QualityMetadata = {
  status?: PakeStatus;
  confidence_score?: number;
  verification_status?: PakeVerificationStatus;
  pake_type?: PakeType;
};

