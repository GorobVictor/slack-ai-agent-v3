import type { UpsertAutoApprovedSkillInput } from "../../ports/generated-skill.port.js";

export const GENERATED_SKILL_ALLOWED_TOOLS = ["getSlackHistoryContext"] as const;

export type GeneratedSkillCandidate = {
  shouldCreate: boolean;
  name: string;
  description: string;
  body: string;
  allowedTools?: string;
  confidence: number;
  reason: string;
};

export type GeneratedSkillPolicyResult =
  | {
      status: "approved";
      skill: UpsertAutoApprovedSkillInput;
    }
  | {
      status: "rejected";
      reason: string;
    };

const MIN_CONFIDENCE = 0.85;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_BODY_LINES = 500;
const MAX_BODY_LENGTH = 12_000;
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SECRET_PATTERNS = [
  /\bxox[baprs]-[A-Za-z0-9-]+/i,
  /\bsk-[A-Za-z0-9_-]{16,}/i,
  /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[A-Za-z0-9._-]{12,}/i,
  /\b[A-Za-z0-9+/]{32,}={0,2}\b/,
];
const SLACK_ID_PATTERN = /\b[UTC][A-Z0-9]{8,}\b/;
const UNSAFE_INSTRUCTION_PATTERN =
  /\b(ignore|bypass|override|disable)\b.{0,80}\b(system prompt|developer instruction|security|policy|rules?)\b/i;

export function validateGeneratedSkillCandidate(
  candidate: GeneratedSkillCandidate,
): GeneratedSkillPolicyResult {
  if (!candidate.shouldCreate) {
    return {
      status: "rejected",
      reason: "Candidate did not request creation.",
    };
  }

  const name = normalizeSkillName(candidate.name);
  const description = normalizeSkillDescription(candidate.description);
  const body = candidate.body.trim();
  const reason = candidate.reason.trim();
  const allowedTools = normalizeAllowedTools(candidate.allowedTools);

  if (candidate.confidence < MIN_CONFIDENCE) {
    return {
      status: "rejected",
      reason: "Candidate confidence is below the auto-approval threshold.",
    };
  }

  if (!NAME_PATTERN.test(name) || name.length > MAX_NAME_LENGTH) {
    return {
      status: "rejected",
      reason: "Candidate name must be lowercase kebab-case and at most 64 characters.",
    };
  }

  if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      status: "rejected",
      reason: "Candidate description is missing or too long.",
    };
  }

  if (!body || body.length > MAX_BODY_LENGTH || body.split("\n").length > MAX_BODY_LINES) {
    return {
      status: "rejected",
      reason: "Candidate body is missing or too large.",
    };
  }

  if (allowedTools && !GENERATED_SKILL_ALLOWED_TOOLS.some((tool) => tool === allowedTools)) {
    return {
      status: "rejected",
      reason: "Candidate requested a tool that generated skills are not allowed to use.",
    };
  }

  const searchableText = [name, description, body, reason].join("\n");

  if (SECRET_PATTERNS.some((pattern) => pattern.test(searchableText))) {
    return {
      status: "rejected",
      reason: "Candidate appears to contain secrets or credentials.",
    };
  }

  if (SLACK_ID_PATTERN.test(searchableText)) {
    return {
      status: "rejected",
      reason: "Candidate appears to contain Slack-specific identifiers.",
    };
  }

  if (UNSAFE_INSTRUCTION_PATTERN.test(searchableText)) {
    return {
      status: "rejected",
      reason: "Candidate attempts to weaken system, security, or policy instructions.",
    };
  }

  return {
    status: "approved",
    skill: {
      name,
      description,
      body,
      allowedTools,
      confidence: candidate.confidence,
      autoApprovalReason: reason || "Auto-approved reusable conversation pattern.",
    },
  };
}

function normalizeAllowedTools(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeSkillName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeSkillDescription(value: string): string {
  const description = value.trim();

  if (!description || /\buse when\b/i.test(description)) {
    return description;
  }

  return `${description} Use when a future user request clearly matches this reusable workflow.`;
}
