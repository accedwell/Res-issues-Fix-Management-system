import { badRequest } from "../lib/http.js";
import { listCategories } from "../store/categories.js";
import { listBlocks } from "../store/settings.js";
import { getUser } from "../store/users.js";
import { PRIORITIES, type Issue, type Priority, type User } from "../types.js";
import { recommendStaff, type StaffWithWorkload } from "./assignment.js";
import { assignIssue, createIssue } from "./issueWorkflow.js";

// This is the "AI" layer. It is deliberately local and deterministic: it extracts
// the important details from a student's message, asks for anything missing, then
// creates the report and lets the workload-aware assignment engine pick the staff.

export interface ChatDraft {
  title?: string;
  description?: string;
  category?: string;
  residence?: string;
  room?: string;
  priority?: Priority;
}

export interface ChatRequest {
  message?: string;
  draft?: ChatDraft;
  confirm?: boolean;
}

export interface StaffSummary {
  id: string;
  name: string;
  specialization: string;
}

export interface ChatResult {
  reply: string;
  draft: ChatDraft;
  ready: boolean;
  staff?: StaffSummary;
  issue?: Issue;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  plumbing: ["tap", "leak", "pipe", "toilet", "drain", "sink", "basin", "shower", "geyser", "sewage", "flush", "blocked"],
  water: ["water supply", "no water", "burst pipe", "water tank", "water pressure", "hot water", "cold water", "water"],
  electrical: ["plug", "socket", "power", "electricity", "trip", "breaker", "wiring", "outage", "electric shock", "short circuit", "sparking"],
  lighting: ["light", "bulb", "lamp", "dark", "flicker", "fluorescent", "tube light"],
  wifi: ["wifi", "wi-fi", "internet", "network", "router", "signal", "connection", "ethernet"],
  furniture: ["chair", "desk", "bed", "wardrobe", "cupboard", "table", "furniture", "drawer", "mattress", "door handle"],
  cleaning: ["dirty", "clean", "trash", "bin", "rubbish", "spill", "pest", "cockroach", "rat", "mice", "mold", "mould"],
  security: ["lock", "key", "security", "burglar", "break-in", "gate", "fence", "camera"],
  heating: ["heater", "heating", "aircon", "air con", "air conditioner", "radiator", "temperature", "cold", "hot water"],
  damage: ["broken window", "crack", "ceiling", "wall", "roof", "floor", "tile", "damage", "hole", "window"],
};

const LOCATIONS = [
  "common room",
  "bathroom",
  "kitchen",
  "hallway",
  "corridor",
  "lobby",
  "reception",
  "laundry",
  "stairwell",
  "balcony",
  "parking",
  "side entrance",
  "study room",
  "tv room",
];

const URGENT_WORDS = [
  "fire",
  "smoke",
  "gas",
  "flood",
  "electric shock",
  "electrocution",
  "sparking",
  "emergency",
  "danger",
  "burst pipe",
  "no water",
  "no power",
];

const HIGH_WORDS = ["leak", "broken", "not working", "urgent", "locked out", "no hot water", "unsafe", "security"];

function isAffirmative(text: string): boolean {
  const cleaned = text.trim().toLowerCase().replace(/[.!?]+$/, "");
  return (
    ["yes", "yeah", "yep", "sure", "ok", "okay", "submit", "confirm", "go ahead", "do it", "please do", "yes please", "correct"].includes(cleaned) ||
    /^(yes|yeah|yep|sure|ok|okay|confirm|submit|go ahead|do it)\b/.test(cleaned)
  );
}

function isNegative(text: string): boolean {
  const cleaned = text.trim().toLowerCase().replace(/[.!?]+$/, "");
  return ["no", "nope", "cancel", "stop", "don't", "do not", "not yet", "no thanks"].includes(cleaned);
}

function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  let best = "other";
  let bestScore = 0;

  for (const [key, words] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = words.reduce((total, word) => (lower.includes(word) ? total + word.length : total), 0);
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }

  return best;
}

function detectPriority(text: string): Priority {
  const lower = text.toLowerCase();
  if (URGENT_WORDS.some((word) => lower.includes(word))) return "Urgent";
  if (HIGH_WORDS.some((word) => lower.includes(word))) return "High";
  if (lower.includes("minor") || lower.includes("cosmetic") || lower.includes("squeak")) return "Low";
  return "Normal";
}

function detectBlock(text: string, blocks: string[]): string | undefined {
  const lower = text.toLowerCase();
  const exact = blocks.find((block) => lower.includes(block.toLowerCase()));
  if (exact) return exact;

  const match = lower.match(/\bblock\s*([a-f])\b/) || lower.match(/\b([a-f])\s*block\b/);
  if (match) return `Block ${match[1].toUpperCase()}`;

  const trimmed = text.trim();
  if (/^[a-f]$/i.test(trimmed)) return `Block ${trimmed.toUpperCase()}`;
  return undefined;
}

function detectRoom(text: string): string | undefined {
  const lower = text.toLowerCase();
  const location = LOCATIONS.find((place) => lower.includes(place));
  if (location) return location.replace(/\b\w/g, (char) => char.toUpperCase());

  const room = lower.match(/(?:room|rm|unit|flat|apartment)\s*[:#-]?\s*([a-z]?\d{1,4}[a-z]?)/);
  if (room) return room[1].toUpperCase();

  const compact = lower.match(/\b([a-f]\d{1,4})\b/);
  if (compact) return compact[1].toUpperCase();

  const trimmed = text.trim();
  if (/^\d{1,4}[a-z]?$/i.test(trimmed)) return trimmed.toUpperCase();
  return undefined;
}

function descriptionCandidate(text: string): string | undefined {
  if (/^\d{1,4}[a-z]?$/i.test(text.trim())) return undefined;

  let rest = text
    .replace(/\bblock\s*[a-f]\b/gi, " ")
    .replace(/\b(?:room|rm|unit|flat|apartment)\s*[:#-]?\s*[a-z]?\d{1,4}[a-z]?\b/gi, " ")
    .replace(/\b[a-f]\d{1,4}\b/gi, " ");

  for (const place of LOCATIONS) {
    rest = rest.replace(new RegExp(`\\b${place}\\b`, "gi"), " ");
  }

  rest = rest
    .replace(/\b(?:in|at|on|the|my|our|is|it'?s|there'?s|please)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return rest.length >= 3 ? text.trim() : undefined;
}

function titleFrom(description: string): string {
  const firstSentence = description.split(/[.!?]/)[0].trim() || description.trim();
  const shortened = firstSentence.length > 64 ? `${firstSentence.slice(0, 61).trimEnd()}…` : firstSentence;
  return shortened.charAt(0).toUpperCase() + shortened.slice(1);
}

function mergeDraft(draft: ChatDraft, message: string, blocks: string[]): ChatDraft {
  const next: ChatDraft = { ...draft };

  const category = detectCategory(message);
  if (!next.category || (category !== "other" && next.category === "other")) next.category = category;

  const block = detectBlock(message, blocks);
  if (block) next.residence = block;

  const room = detectRoom(message);
  if (room) next.room = room;

  const priority = detectPriority(message);
  if (!next.priority || priority !== "Normal") next.priority = priority;

  const description = descriptionCandidate(message);
  if (description) {
    next.description = next.description ? `${next.description} ${description}` : description;
  }

  if (!next.title && next.description) next.title = titleFrom(next.description);
  return next;
}

function isReady(draft: ChatDraft): boolean {
  return Boolean(draft.description && draft.residence && draft.room);
}

function nextQuestion(draft: ChatDraft): string {
  if (!draft.description) return "What exactly is the problem? For example: 'The bathroom tap is leaking.'";
  if (!draft.residence) return "Which block is this in? (Block A–F)";
  if (!draft.room) return "Which room or location? For example: 204, the common room, or the 2nd floor hallway.";
  return "Please tell me a little more about the problem.";
}

function summarize(draft: ChatDraft, categoryLabel: string, staff?: StaffSummary): string {
  const lines = [
    "Here is what I have so far:",
    `• Problem: ${draft.description ?? "—"}`,
    `• Category: ${categoryLabel}`,
    `• Location: ${draft.residence ?? "—"}${draft.room ? ` · ${draft.room}` : ""}`,
    `• Priority: ${draft.priority ?? "Normal"}`,
  ];
  if (staff) lines.push(`• AI match: ${staff.name} (${staff.specialization})`);
  return lines.join("\n");
}

function toSummary(staff: StaffWithWorkload | undefined): StaffSummary | undefined {
  return staff ? { id: staff.id, name: staff.name, specialization: staff.specialization } : undefined;
}

export async function chatTurn(student: User, request: ChatRequest): Promise<ChatResult> {
  const message = typeof request.message === "string" ? request.message.trim() : "";
  if (!message) throw badRequest("Message is required");

  let draft: ChatDraft = { ...(request.draft ?? {}) };
  if (draft.priority && !PRIORITIES.includes(draft.priority)) delete draft.priority;

  const blocks = await listBlocks();
  const categories = await listCategories();
  const yes = isAffirmative(message);
  const no = isNegative(message);

  if (!yes && !no) draft = mergeDraft(draft, message, blocks);

  const categoryKey = draft.category ?? "other";
  const categoryLabel = categories.find((category) => category.key === categoryKey)?.name ?? "Other";
  const ready = isReady(draft);
  const suggested = ready ? toSummary(await recommendStaff({ category: categoryKey })) : undefined;

  if (ready && (request.confirm === true || yes)) {
    const issue = await createIssue(student, {
      title: draft.title || titleFrom(draft.description ?? "Maintenance issue"),
      category: categoryKey,
      priority: draft.priority ?? "Normal",
      residence: draft.residence ?? "",
      room: draft.room ?? "",
      description: draft.description ?? "",
      photo: false,
    });

    try {
      const assigned = await assignIssue(issue.id);
      const assignedUser = assigned.assignedTo ? await getUser(assigned.assignedTo) : undefined;
      const staff = assignedUser
        ? {
            id: assignedUser.id,
            name: assignedUser.name,
            specialization: assignedUser.specialization ?? "General Maintenance",
          }
        : suggested;

      return {
        reply: `Done! Your report ${assigned.ref} has been logged and assigned to ${staff?.name ?? "the maintenance team"}${
          staff ? ` (${staff.specialization})` : ""
        }. You can track it under My Reports.`,
        draft,
        ready: true,
        staff,
        issue: assigned,
      };
    } catch {
      return {
        reply: `I logged your report ${issue.ref}, but I could not assign a maintenance staff member automatically. An administrator will assign someone shortly.`,
        draft,
        ready: true,
        issue,
      };
    }
  }

  if (ready) {
    return {
      reply: `${summarize(draft, categoryLabel, suggested)}\n\nShall I submit this report and assign ${
        suggested?.name ?? "the best maintenance staff member"
      }? Reply yes to confirm.`,
      draft,
      ready: true,
      staff: suggested,
    };
  }

  return { reply: nextQuestion(draft), draft, ready: false, staff: suggested };
}
