"use client";

import { useEffect, useRef } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { MediaCanvas, type MediaCanvasHandle } from "@/components/feed/MediaCanvas";
import { PostViewerSidebar } from "@/components/feed/PostViewerSidebar";
import type { GifResult } from "@/lib/giphy/client";
import type { CommentItem, FeedPost } from "@/lib/types/feed";

type ReplyTarget = { postId: string; commentId: string; displayName: string } | null;
type EditingPost = { id: string; title: string; content: string };

/**
 * The immersive feed media viewer — dark zoomable/pannable canvas on the
 * left, the post's full social context on the right, built on Base UI's
 * Dialog primitives directly (not the boxed components/ui/dialog.tsx
 * wrapper) so the layout can go full-bleed while still getting focus-trap,
 * Escape-to-close, and return-focus for free. Only used by the feed page —
 * components/ImageLightbox.tsx is untouched and still serves the simpler
 * medicine/marketplace/food image lightboxes.
 */
export function MediaViewer({
  open,
  onClose,
  post,
  images,
  index,
  onIndexChange,
  dbUser,
  editingPost,
  onEditingPostChange,
  savingPostEdit,
  onSaveEdit,
  onCancelEdit,
  autoResize,
  votingPost,
  onVote,
  onPin,
  onEdit,
  onDelete,
  onReact,
  onOpenReactions,
  onOpenVoters,
  comments,
  commentsLoading,
  hasMoreComments,
  loadingMoreComments,
  onLoadMoreComments,
  onEnsureCommentsLoaded,
  replyingTo,
  replyDraft,
  replySending,
  expandedReplies,
  commentDraft,
  commentSending,
  currentUserName,
  currentUserAvatar,
  dbUserId,
  isModerator,
  onSetReplyingTo,
  onReplyDraftChange,
  onSubmitReply,
  onToggleExpandedReplies,
  onDeleteComment,
  onReactToComment,
  onOpenCommentReactions,
  onCommentDraftChange,
  onSubmitComment,
  employees = [],
  onNeedEmployees,
}: {
  open: boolean;
  onClose: () => void;
  post: FeedPost | null;
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  dbUser: { id: string; role: string } | null | undefined;
  editingPost: EditingPost | null;
  onEditingPostChange: (updater: (prev: EditingPost | null) => EditingPost | null) => void;
  savingPostEdit: boolean;
  onSaveEdit: (post: FeedPost) => void;
  onCancelEdit: () => void;
  autoResize: (el: HTMLTextAreaElement) => void;
  votingPost: string | null;
  onVote: (postId: string, optionId: string) => void;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (postId: string, emoji: string) => void;
  onOpenReactions: () => void;
  onOpenVoters: (optionId: string | null) => void;
  comments: CommentItem[];
  commentsLoading: boolean;
  hasMoreComments: boolean;
  loadingMoreComments: boolean;
  onLoadMoreComments: (postId: string) => void;
  onEnsureCommentsLoaded: (postId: string) => void;
  replyingTo: ReplyTarget;
  replyDraft: Record<string, string>;
  replySending: Record<string, boolean>;
  expandedReplies: Record<string, boolean>;
  commentDraft: Record<string, string>;
  commentSending: Record<string, boolean>;
  currentUserName: string;
  currentUserAvatar: string | null;
  dbUserId?: string;
  isModerator: boolean;
  onSetReplyingTo: (value: ReplyTarget) => void;
  onReplyDraftChange: (commentId: string, value: string) => void;
  onSubmitReply: (postId: string, commentId: string) => void;
  onToggleExpandedReplies: (commentId: string) => void;
  onDeleteComment: (postId: string, commentId: string, parentId?: string) => void;
  onReactToComment: (postId: string, commentId: string, emoji: string, parentId?: string) => void;
  onOpenCommentReactions: (postId: string, commentId: string) => void;
  onCommentDraftChange: (postId: string, value: string) => void;
  onSubmitComment: (postId: string, gif?: GifResult, encodedContent?: string) => void;
  employees?: { id: string; displayName: string }[];
  onNeedEmployees?: () => void;
}) {
  const canvasRef = useRef<MediaCanvasHandle>(null);
  const postId = post?.id ?? null;

  // FeedPage necessarily passes these as fresh inline closures every render
  // (they read live commentsCache/index state) — read them through refs so
  // these effects only re-run when open/postId/index actually change, not on
  // every FeedPage render. Depending on the callbacks directly previously
  // caused a render → effect → setState → render loop (setCommentsLoading
  // always produces a new object, so every re-run looked like "new work").
  const onEnsureCommentsLoadedRef = useRef(onEnsureCommentsLoaded);
  useEffect(() => { onEnsureCommentsLoadedRef.current = onEnsureCommentsLoaded; }, [onEnsureCommentsLoaded]);
  const onIndexChangeRef = useRef(onIndexChange);
  useEffect(() => { onIndexChangeRef.current = onIndexChange; }, [onIndexChange]);

  // The sidebar always shows comments regardless of the feed card's own
  // collapsed/expanded toggle — make sure they're actually fetched.
  useEffect(() => {
    if (open && postId) onEnsureCommentsLoadedRef.current(postId);
  }, [open, postId]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping = !!target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable);
      if (isTyping) return;
      if (e.key === "+" || e.key === "=") { e.preventDefault(); canvasRef.current?.zoomIn(); }
      else if (e.key === "-") { e.preventDefault(); canvasRef.current?.zoomOut(); }
      else if (e.key === "0") { e.preventDefault(); canvasRef.current?.fit(); }
      else if (e.key === "ArrowLeft" && index > 0) { onIndexChangeRef.current(index - 1); }
      else if (e.key === "ArrowRight" && index < images.length - 1) { onIndexChangeRef.current(index + 1); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, index, images.length]);

  if (!post) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-black/95 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className="fixed inset-0 z-40 flex flex-col lg:flex-row outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        >
          <DialogPrimitive.Title className="sr-only">
            {post.title || `Photo shared by ${post.author.displayName}`}
          </DialogPrimitive.Title>

          <DialogPrimitive.Close
            aria-label="Close photo viewer"
            className="absolute top-3 left-3 z-20 p-2.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="w-5 h-5" />
          </DialogPrimitive.Close>

          <div className="flex-1 min-h-0 min-w-0 flex">
            <MediaCanvas
              ref={canvasRef}
              images={images}
              index={index}
              onIndexChange={onIndexChange}
              authorName={post.author.displayName}
            />
          </div>

          <div className="h-[42vh] lg:h-full w-full lg:w-[400px] xl:w-[440px] shrink-0 lg:border-l border-t lg:border-t-0 border-black/10">
            <PostViewerSidebar
              post={post}
              dbUser={dbUser}
              editingPost={editingPost}
              onEditingPostChange={onEditingPostChange}
              savingPostEdit={savingPostEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              autoResize={autoResize}
              votingPost={votingPost}
              onVote={onVote}
              onPin={onPin}
              onEdit={onEdit}
              onDelete={onDelete}
              onReact={onReact}
              onOpenReactions={onOpenReactions}
              onOpenVoters={onOpenVoters}
              comments={comments}
              commentsLoading={commentsLoading}
              hasMoreComments={hasMoreComments}
              loadingMoreComments={loadingMoreComments}
              onLoadMoreComments={onLoadMoreComments}
              replyingTo={replyingTo}
              replyDraft={replyDraft}
              replySending={replySending}
              expandedReplies={expandedReplies}
              commentDraft={commentDraft}
              commentSending={commentSending}
              currentUserName={currentUserName}
              currentUserAvatar={currentUserAvatar}
              dbUserId={dbUserId}
              isModerator={isModerator}
              onSetReplyingTo={onSetReplyingTo}
              onReplyDraftChange={onReplyDraftChange}
              onSubmitReply={onSubmitReply}
              onReactToComment={onReactToComment}
              onOpenCommentReactions={onOpenCommentReactions}
              onToggleExpandedReplies={onToggleExpandedReplies}
              onDeleteComment={onDeleteComment}
              onCommentDraftChange={onCommentDraftChange}
              onSubmitComment={onSubmitComment}
              employees={employees}
              onNeedEmployees={onNeedEmployees}
            />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
