import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  create: vi.fn(),
  getOpenAIClient: vi.fn(),
}));

vi.mock("@/lib/openai/client", () => ({
  getOpenAIClient: doubles.getOpenAIClient,
}));

import { moderateContent } from "./moderation";

function completionWith(json: unknown) {
  return { choices: [{ message: { content: JSON.stringify(json) } }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  doubles.getOpenAIClient.mockReturnValue({ chat: { completions: { create: doubles.create } } });
});

describe("moderateContent", () => {
  it("returns allowed with no API call when there is nothing to check", async () => {
    const result = await moderateContent({ body: null });
    expect(result).toEqual({ blocked: false });
    expect(doubles.create).not.toHaveBeenCalled();
  });

  it("blocks content the model flags as a violation", async () => {
    doubles.create.mockResolvedValue(
      completionWith({ blocked: true, reason: "Personal attack on a named coworker." })
    );
    const result = await moderateContent({ title: "you're pathetic", body: "everyone agrees you should quit" });
    expect(result).toEqual({ blocked: true, reason: "Personal attack on a named coworker." });
  });

  it("allows banter the model does not flag", async () => {
    doubles.create.mockResolvedValue(completionWith({ blocked: false, reason: "" }));
    const result = await moderateContent({ body: "haha nice one, close tayo?" });
    expect(result.blocked).toBe(false);
  });

  it("includes a GIF image block when gifId is present", async () => {
    doubles.create.mockResolvedValue(completionWith({ blocked: false, reason: "" }));
    await moderateContent({ body: "reacting to the shoutout", gifId: "abc123" });
    const call = doubles.create.mock.calls[0][0];
    const userMessage = call.messages.find((m: { role: string }) => m.role === "user");
    const imageBlock = userMessage.content.find((c: { type: string }) => c.type === "image_url");
    expect(imageBlock.image_url.url).toBe("https://media.giphy.com/media/abc123/giphy.gif");
  });

  it("fails open when the API call throws", async () => {
    doubles.create.mockRejectedValue(new Error("network error"));
    const result = await moderateContent({ body: "some content" });
    expect(result).toEqual({ blocked: false });
  });

  it("fails open when the OpenAI client fails to construct (e.g. missing API key)", async () => {
    // Mirrors the real SDK: it throws synchronously in its constructor when
    // no apiKey is configured, not when a request is made.
    doubles.getOpenAIClient.mockImplementation(() => {
      throw new Error("Missing credentials. Please pass an apiKey...");
    });
    const result = await moderateContent({ body: "some content" });
    expect(result).toEqual({ blocked: false });
  });

  it("fails open when the response is not valid JSON", async () => {
    doubles.create.mockResolvedValue({ choices: [{ message: { content: "not json" } }] });
    const result = await moderateContent({ body: "some content" });
    expect(result).toEqual({ blocked: false });
  });

  it("fails open when the response is missing the blocked field", async () => {
    doubles.create.mockResolvedValue(completionWith({ reason: "whoops" }));
    const result = await moderateContent({ body: "some content" });
    expect(result).toEqual({ blocked: false });
  });
});
