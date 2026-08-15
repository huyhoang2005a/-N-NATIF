import { z } from "zod";

/** Not spec-mandated — explicit user-approved addition (2026-08, demo phase). v1 scope
 * only: general platform Q&A, no account-specific data access (see plan artifact) — so
 * the request shape deliberately carries no case/organization id, just the conversation
 * itself. `history` lets the client resend prior turns for context since the server
 * doesn't persist conversations for v1. */
export const AssistantChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});
export type AssistantChatMessage = z.infer<typeof AssistantChatMessageSchema>;

export const AssistantChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  history: z.array(AssistantChatMessageSchema).max(20).optional(),
});
export type AssistantChatRequest = z.infer<typeof AssistantChatRequestSchema>;

export interface AssistantChatResponse {
  reply: string;
}
