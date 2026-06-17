import type {
  AutoApprovedGeneratedSkillCandidate,
  GeneratedSkillBody,
  SaveAutoApprovedSkillDecisionInput,
} from "../../ports/generated-skill.port.js";
import {
  GENERATED_SKILL_ALLOWED_TOOL,
  GENERATED_SKILL_DEFAULT_DESCRIPTION_SUFFIX,
} from "../../prompts/generated-skills.prompts.js";
import { normalizeGeneratedSkillBody } from "./generated-skill-body.js";

const GENERATED_SKILL_ALLOWED_TOOLS = [GENERATED_SKILL_ALLOWED_TOOL] as const;

export type TypedGeneratedSkillCandidate = {
  name: string;
  description: string;
  body: GeneratedSkillBody;
  allowedTools?: string;
  confidence: number;
  reason: string;
};

export type SkillReflectionDecision =
  | {
      action: "skip";
      reason: string;
      confidence: number;
    }
  | {
      action: "create";
      candidate: TypedGeneratedSkillCandidate;
    }
  | {
      action: "update";
      candidate: TypedGeneratedSkillCandidate;
    };

export type GeneratedSkillPolicyResult =
  | {
      status: "approved";
      decision: SaveAutoApprovedSkillDecisionInput;
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
  decision: SkillReflectionDecision,
): GeneratedSkillPolicyResult {
  if (decision.action === "skip") {
    return {
      status: "rejected",
      reason: decision.reason || "Skill reflection chose to skip creation.",
    };
  }

  const candidate = decision.candidate;
  const name = normalizeSkillName(candidate.name);
  const description = normalizeSkillDescription(candidate.description);
  const bodyJson = normalizeGeneratedSkillBody(candidate.body);
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

  const bodyValidationError = validateSkillBody(bodyJson);

  if (bodyValidationError) {
    return {
      status: "rejected",
      reason: bodyValidationError,
    };
  }

  if (allowedTools && !GENERATED_SKILL_ALLOWED_TOOLS.some((tool) => tool === allowedTools)) {
    return {
      status: "rejected",
      reason: "Candidate requested a tool that generated skills are not allowed to use.",
    };
  }

  const searchableText = [name, description, JSON.stringify(bodyJson), reason].join("\n");

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

  const approvedCandidate: AutoApprovedGeneratedSkillCandidate = {
    name,
    description,
    body: bodyJson,
    allowedTools,
    confidence: candidate.confidence,
    autoApprovalReason: reason || "Auto-approved reusable conversation pattern.",
  };

  if (decision.action === "update") {
    return {
      status: "approved",
      decision: {
        action: "update",
        candidate: approvedCandidate,
      },
    };
  }

  return {
    status: "approved",
    decision: {
      action: "create",
      candidate: approvedCandidate,
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

  return `${description} ${GENERATED_SKILL_DEFAULT_DESCRIPTION_SUFFIX}`;
}

function validateSkillBody(body: GeneratedSkillBody): string | null {
  const serialized = JSON.stringify(body);
  const renderedLineCount = [
    body.goal,
    ...body.triggers,
    ...body.instructions,
    ...(body.safetyNotes ?? []),
    ...(body.toolUsage?.map((usage) => `${usage.tool} ${usage.when}`) ?? []),
  ].join("\n").split("\n").length;

  if (!body.goal || body.goal.length > MAX_BODY_LENGTH) {
    return "Candidate body goal is missing or too large.";
  }

  if (body.triggers.length === 0) {
    return "Candidate body must include at least one trigger.";
  }

  if (body.instructions.length === 0) {
    return "Candidate body must include at least one instruction.";
  }

  if (serialized.length > MAX_BODY_LENGTH || renderedLineCount > MAX_BODY_LINES) {
    return "Candidate body is too large.";
  }

  if (body.toolUsage?.some((usage) => !GENERATED_SKILL_ALLOWED_TOOLS.some((tool) => tool === usage.tool))) {
    return "Candidate body requested a tool that generated skills are not allowed to use.";
  }

  return null;
}
