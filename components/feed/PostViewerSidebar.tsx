"use client";

import { PostBody } from "@/components/feed/PostBody";
import { PostEngagement } from "@/components/feed/PostEngagement";
import { CommentList, CommentComposer } from "@/components/feed/CommentThread";
import type { CommentItem, FeedPost } from "@/lib/types/feed";

type ReplyTarget = { postId: string; commentId: string; displayName: string } | null;
type EditingPost = { id: string; title: string; content: string };

/**
 * The right-hand social panel of the media viewer: post header/content up
 * top (fixed), reactions + comments below in their own scroll region, and
 * the comment composer pinned at the bottom — independent scrolling per
 * requirement #13, everything else reused unchanged from the feed card
 * (PostBody, PostEngagement, CommentList/CommentComposer) so viewer and card
 * render the exact same components against the exact same post state.
 */
export function PostViewerSidebar({
  post,
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
  comments,
  commentsLoading,
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
  onCommentDraftChange,
  onSubmitComment,
}: {
  post: FeedPost;
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
  comments: CommentItem[];
  commentsLoading: boolean;
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
  onCommentDraftChange: (postId: string, value: string) => void;
  onSubmitComment: (postId: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <div className="shrink-0 border-b border-gray-100 px-4 py-4 sm:px-5 overflow-y-auto max-h-[45%]">
        <PostBody
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
        />
      </div>

      <div className="shrink-0 px-4 sm:px-5 pt-2">
        <PostEngagement
          postId={post.id}
          reactions={post.reactions}
          myReactions={post.myReactions}
          commentCount={post.commentCount}
          commentsOpen
          onReact={onReact}
          onToggleComments={() => {}}
          onOpenReactions={onOpenReactions}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 pb-3 pt-2 border-t border-black/5">
        <CommentList
          postId={post.id}
          comments={comments}
          loading={commentsLoading}
          replyingTo={replyingTo}
          replyDraft={replyDraft}
          replySending={replySending}
          expandedReplies={expandedReplies}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          dbUserId={dbUserId}
          isModerator={isModerator}
          onSetReplyingTo={onSetReplyingTo}
          onReplyDraftChange={onReplyDraftChange}
          onSubmitReply={onSubmitReply}
          onToggleExpandedReplies={onToggleExpandedReplies}
          onDeleteComment={onDeleteComment}
          autoResize={autoResize}
        />
      </div>

      <div className="shrink-0 border-t border-gray-100 px-4 sm:px-5 py-3">
        <CommentComposer
          postId={post.id}
          commentDraft={commentDraft}
          commentSending={commentSending}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          onCommentDraftChange={onCommentDraftChange}
          onSubmitComment={onSubmitComment}
          autoResize={autoResize}
          className=""
        />
      </div>
    </div>
  );
}
