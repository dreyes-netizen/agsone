import { getOpenAIClient } from "@/lib/openai/client";

export type ModerationResult = { blocked: boolean; reason?: string };

export type ModerateInput = {
  title?: string | null;
  body: string | null;
  gifId?: string | null;
};

const SYSTEM_PROMPT = `You are Alexa, a content moderator for the internal employee Feed at Alliance Global Solutions.

Decide whether a Feed post, comment, or reply should be BLOCKED before it is ever published.

ALLOW (blocked: false):
- Casual banter, teasing, and inside jokes between coworkers, even when pointed or sarcastic.
- Jokes that reference someone by name in a lighthearted way (e.g. a "you're my next target" meme
  GIF dropped into a friendly thread, a teasing "are we even now?" reply).
- Complaints about work, venting about a bad day, casual profanity used for emphasis rather than
  as an insult directed at a person.

BLOCK (blocked: true):
- Harassment, personal attacks, or insults directed at a specific person.
- Slurs, hate speech, or discriminatory language of any kind.
- Threats of violence or intimidation, even if framed as a joke.
- Sexual harassment or explicit sexual content.
- Content that is "below the belt" -- attacking someone's character, appearance, family, or
  personal struggles rather than just teasing them.

When uncertain, lean toward ALLOW -- the bar is "not below the belt," not "inoffensive." Judge an
attached image/GIF in the context of the surrounding text, not in isolation.

Respond with ONLY a JSON object: {"blocked": boolean, "reason": string}. "reason" is a short,
specific explanation (max 200 characters) -- required when blocked is true, an empty string when
blocked is false.`;

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export async function moderateContent({ title, body, gifId }: ModerateInput): Promise<ModerationResult> {
  const textParts = [title, body].filter((t): t is string => Boolean(t && t.trim()));
  if (textParts.length === 0 && !gifId) return { blocked: false };

  const content: ContentPart[] = [];
  if (textParts.length > 0) content.push({ type: "text", text: textParts.join("\n\n") });
  if (gifId) content.push({ type: "image_url", image_url: { url: `https://media.giphy.com/media/${gifId}/giphy.gif` } });

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      max_tokens: 150,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: content as never },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { blocked: false };

    const parsed = JSON.parse(raw) as { blocked?: unknown; reason?: unknown };
    if (typeof parsed.blocked !== "boolean") {
      console.error("[moderateContent] Alexa response missing valid 'blocked' field, failing open:", parsed);
      return { blocked: false };
    }

    return {
      blocked: parsed.blocked,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    };
  } catch (err) {
    console.error("[moderateContent] Alexa check failed, failing open:", err);
    return { blocked: false };
  }
}
