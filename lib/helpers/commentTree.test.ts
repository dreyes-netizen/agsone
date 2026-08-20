import { describe, it, expect } from "vitest";
import { findCommentById } from "./commentTree";
import type { CommentItem, ReplyItem } from "@/lib/types/feed";

function makeComment(overrides: Partial<CommentItem> = {}): CommentItem {
  return {
    id: "c1",
    content: "hello",
    commentType: "TEXT",
    gifProvider: null,
    gifId: null,
    createdAt: "2026-08-20T00:00:00.000Z",
    authorId: "u1",
    author: { displayName: "Alice", avatarUrl: null },
    reactions: {},
    myReactions: [],
    replies: [],
    ...overrides,
  };
}

function makeReply(overrides: Partial<ReplyItem> = {}): ReplyItem {
  return {
    id: "r1",
    content: "hi",
    commentType: "TEXT",
    gifProvider: null,
    gifId: null,
    createdAt: "2026-08-20T00:00:00.000Z",
    parentId: "c1",
    authorId: "u2",
    author: { displayName: "Bob", avatarUrl: null },
    reactions: {},
    myReactions: [],
    ...overrides,
  };
}

describe("findCommentById", () => {
  it("finds a top-level comment by id", () => {
    const comments = [makeComment({ id: "c1" }), makeComment({ id: "c2" })];
    expect(findCommentById(comments, "c2")?.id).toBe("c2");
  });

  it("finds a reply nested under a top-level comment", () => {
    const comments = [makeComment({ id: "c1", replies: [makeReply({ id: "r1" })] })];
    expect(findCommentById(comments, "r1")?.id).toBe("r1");
  });

  it("returns undefined when the id doesn't exist anywhere", () => {
    const comments = [makeComment({ id: "c1", replies: [makeReply({ id: "r1" })] })];
    expect(findCommentById(comments, "missing")).toBeUndefined();
  });
});
