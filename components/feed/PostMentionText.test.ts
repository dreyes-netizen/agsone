import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PostMentionText } from "./PostMentionText";

const noop = () => {};

describe("PostMentionText", () => {
  it("renders a bare URL as a clickable link", () => {
    const html = renderToStaticMarkup(
      createElement(PostMentionText, { content: "check this out https://example.com/path", onMentionClick: noop })
    );
    expect(html).toContain('href="https://example.com/path"');
    expect(html).toContain(">https://example.com/path<");
  });

  it("renders a [label](url) link with the label as the visible text, not the raw URL", () => {
    const html = renderToStaticMarkup(
      createElement(PostMentionText, {
        content: "Survey link: [Complete the survey here](https://example.com/survey)",
        onMentionClick: noop,
      })
    );
    expect(html).toContain('href="https://example.com/survey"');
    expect(html).toContain(">Complete the survey here<");
    expect(html).not.toContain("[Complete the survey here]");
  });

  it("renders a link immediately adjacent to a mention token without cross-matching", () => {
    const html = renderToStaticMarkup(
      createElement(PostMentionText, { content: "@[Jane|user-1]https://example.com", onMentionClick: noop })
    );
    expect(html).toContain(">@Jane<");
    expect(html).toContain('href="https://example.com"');
  });

  it("leaves [label](not a url) as plain text", () => {
    const html = renderToStaticMarkup(
      createElement(PostMentionText, { content: "[label](not a url)", onMentionClick: noop })
    );
    expect(html).not.toContain("<a");
    expect(html).toContain("[label](not a url)");
  });

  it("never turns a javascript: string into a clickable href", () => {
    const html = renderToStaticMarkup(
      createElement(PostMentionText, { content: "click javascript:alert(1) now", onMentionClick: noop })
    );
    expect(html).not.toContain("<a");
    expect(html).not.toContain('href="javascript:');
  });

  it("still renders an account tag pill unaffected by the new link patterns", () => {
    const html = renderToStaticMarkup(
      createElement(PostMentionText, { content: "Shoutout to #[Flyland Recovery|acct-1]", onMentionClick: noop })
    );
    expect(html).toContain("Flyland Recovery");
    expect(html).not.toContain("<a");
  });
});
