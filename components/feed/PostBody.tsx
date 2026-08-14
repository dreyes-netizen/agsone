"use client";

import { useRouter } from "next/navigation";
import { Building2, Check, Sparkles, Trophy } from "lucide-react";
import { PostHeader } from "@/components/feed/PostHeader";
import { PostBadges } from "@/components/feed/PostBadges";
import { PostMentionText } from "@/components/feed/PostMentionText";
import { ExpandableText } from "@/components/feed/ExpandableText";
import { PollBlock } from "@/components/feed/PollBlock";
import { RecipientList } from "@/components/feed/RecipientList";
import { getPostPermissions } from "@/lib/helpers/postPermissions";
import type { FeedPost } from "@/lib/types/feed";

type EditingPost = { id: string; title: string; content: string };

/**
 * Header + type-specific content (standard/poll vs. shoutout) + poll block —
 * the part of a feed post that sits above its images. Shared by the feed
 * card and the media viewer's sidebar (components/feed/PostViewerSidebar.tsx)
 * so a post renders identically in both places instead of two copies of this
 * branching drifting apart. `avatarSize`/`compact` let the viewer sidebar
 * ask for the same slightly denser presentation the feed card already uses.
 */
export function PostBody({
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
}) {
  const router = useRouter();
  const { canPin, canEdit, canDelete } = getPostPermissions(post, dbUser);
  const isEditing = editingPost?.id === post.id;
  const goToProfile = (id: string) => router.push(`/employees/${id}`);

  if (post.type === "SHOUTOUT" && post.shoutoutRecipients.length > 0) {
    // A shoutout post becomes a formal Recognition once it has a title (the
    // composer's "Recognition title" field) — no separate post type/flair
    // exists for this, so title presence is the variant signal. See
    // docs/superpowers/specs for the original single-type shoutout design;
    // this split is purely presentational.
    const isRecognition = !!post.title;

    return (
      <div className="space-y-3">
        <PostHeader
          authorId={post.authorId}
          authorName={post.author.displayName}
          authorAvatarUrl={post.author.avatarUrl}
          department={post.author.department?.name}
          createdAt={post.createdAt}
          isPinned={post.isPinned}
          canPin={canPin}
          canEdit={canEdit}
          canDelete={canDelete}
          onAuthorClick={goToProfile}
          onPin={onPin}
          onEdit={onEdit}
          onDelete={onDelete}
          editLabel={isRecognition ? "Edit recognition" : "Edit shoutout"}
        />

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide ${isRecognition ? "text-amber-600" : "text-orange-600"}`}>
            {isRecognition ? <Trophy className="w-3.5 h-3.5" aria-hidden="true" /> : <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />}
            {isRecognition ? "Recognition" : "Shoutout"}
          </span>
          {post.department && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              <Building2 className="w-2.5 h-2.5" aria-hidden="true" /> {post.department.name} only
            </span>
          )}
        </div>

        {isEditing && editingPost ? (
          <div className="space-y-2">
            <textarea
              value={editingPost.content}
              onChange={(e) => { onEditingPostChange((prev) => (prev ? { ...prev, content: e.target.value } : prev)); autoResize(e.target); }}
              rows={3}
              maxLength={500}
              className="w-full resize-none overflow-hidden text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/30 focus:border-amber-400 placeholder:text-gray-500 transition-all"
            />
            <div className="flex items-center gap-2">
              <button onClick={() => onSaveEdit(post)} disabled={savingPostEdit || !editingPost.content.trim()} className="flex items-center gap-1.5 bg-command-black text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Check className="w-3.5 h-3.5" /> Save
              </button>
              <button onClick={onCancelEdit} className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1.5 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : isRecognition ? (
          <div className="space-y-3">
            <p className="text-base font-bold text-gray-900 leading-snug">{post.title}</p>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recognizing</p>
              <RecipientList recipients={post.shoutoutRecipients} onOpenProfile={goToProfile} rowSize="md" />
            </div>
            <ExpandableText className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              <PostMentionText content={post.content} onMentionClick={goToProfile} />
            </ExpandableText>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500">Shoutout to</p>
            <RecipientList recipients={post.shoutoutRecipients} onOpenProfile={goToProfile} rowSize="md" />
            <p className="text-sm text-gray-600 italic leading-relaxed whitespace-pre-wrap">
              &ldquo;<PostMentionText content={post.content} onMentionClick={goToProfile} />&rdquo;
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <PostHeader
        authorId={post.authorId}
        authorName={post.author.displayName}
        authorAvatarUrl={post.author.avatarUrl}
        department={post.author.department?.name}
        createdAt={post.createdAt}
        isPinned={post.isPinned}
        canPin={canPin}
        canEdit={canEdit}
        canDelete={canDelete}
        onAuthorClick={goToProfile}
        onPin={onPin}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      <PostBadges flairId={post.flair} isPoll={post.type === "POLL"} departmentName={post.department?.name} />

      {isEditing && editingPost ? (
        <div className="space-y-2">
          <input
            type="text"
            value={editingPost.title}
            onChange={(e) => onEditingPostChange((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
            maxLength={120}
            placeholder="Title *"
            className="w-full text-sm font-semibold bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus:border-navy-400 placeholder:font-normal placeholder:text-gray-500 transition-all"
          />
          <textarea
            value={editingPost.content}
            onChange={(e) => { onEditingPostChange((prev) => (prev ? { ...prev, content: e.target.value } : prev)); autoResize(e.target); }}
            rows={3}
            className="w-full resize-none overflow-hidden text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSaveEdit(post)}
              disabled={savingPostEdit || !editingPost.content.trim() || !editingPost.title.trim()}
              className="flex items-center gap-1.5 bg-command-black text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-3.5 h-3.5" /> Save
            </button>
            <button onClick={onCancelEdit} className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1.5 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-1">
          {post.title && <p className="text-base font-bold text-gray-900 leading-snug">{post.title}</p>}
          <ExpandableText className="text-sm text-gray-700 mt-1 leading-relaxed whitespace-pre-wrap">
            <PostMentionText content={post.content} onMentionClick={goToProfile} />
          </ExpandableText>
        </div>
      )}

      {post.type === "POLL" && post.pollOptions.length > 0 && (
        <PollBlock
          postId={post.id}
          options={post.pollOptions}
          myVoteOptionId={post.myVoteOptionId}
          voting={votingPost === post.id}
          onVote={onVote}
        />
      )}
    </div>
  );
}
