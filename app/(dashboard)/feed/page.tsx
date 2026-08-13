"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Send, ImagePlus, X, Check, Megaphone, BarChart2, Sparkles, Star, Gamepad2, ShoppingBag, AlertCircle, Loader2, Cake, Building2 } from "lucide-react";
import { FLAIRS } from "@/lib/flairs";
import { PostImages, imageGridClasses } from "@/components/feed/PostImages";
import { FeedSidebar } from "@/components/feed/FeedSidebar";
import { Avatar } from "@/components/feed/Avatar";
import { PollBlock } from "@/components/feed/PollBlock";
import { CommentThread } from "@/components/feed/CommentThread";
import { PostHeader } from "@/components/feed/PostHeader";
import { PostBadges } from "@/components/feed/PostBadges";
import { PostEngagement } from "@/components/feed/PostEngagement";
import { ExpandableText } from "@/components/feed/ExpandableText";
import { useFeedActions } from "@/lib/hooks/useFeedActions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Closed by default — split into its own chunk instead of shipping with the
// page bundle (this is the largest page in the app).
const ImageLightbox = dynamic(
  () => import("@/components/ImageLightbox").then((m) => m.ImageLightbox),
  { ssr: false },
);


function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function FeedPage() {
  const router = useRouter();
  const { user, dbUser, loading: authLoading } = useAuth();
  const {
    posts, setPosts,
    loading,
    hasNewPosts, setHasNewPosts,
    loadingMore,
    nextCursor, setNextCursor,
    activeFilter, setActiveFilter,
    loadError,
    editingPost, setEditingPost,
    savingPostEdit,
    postTitle, setPostTitle,
    newPost, setNewPost,
    posting,
    pollMode, setPollMode,
    pollOptions, setPollOptions,
    shoutoutMode, setShoutoutMode,
    shoutoutTitle, setShoutoutTitle,
    shoutoutDeptOnly, setShoutoutDeptOnly,
    recipients, setRecipients,
    recipientSearch, setRecipientSearch,
    recipientSearchOpen, setRecipientSearchOpen,
    votingPost,
    openComments,
    commentsCache,
    commentsLoading,
    commentDraft, setCommentDraft,
    commentSending,
    replyingTo, setReplyingTo,
    replyDraft, setReplyDraft,
    replySending,
    expandedReplies, setExpandedReplies,
    selectedFlair, setSelectedFlair,
    showAllFlairs, setShowAllFlairs,
    composeExpanded, setComposeExpanded,
    deptOnly, setDeptOnly,
    mentionQuery,
    mentionResults,
    imageFiles,
    imagePreviews,
    uploading,
    lightbox, setLightbox,
    postToast,
    commentDeleteTarget, setCommentDeleteTarget,
    postDeleteTarget, setPostDeleteTarget,
    employees,
    profile,
    leaderboard,
    birthdays,
    widgetsLoading,
    fileInputRef,
    composerRef,
    titleInputRef,
    mentionDropdownRef,
    recipientSearchRef,
    load,
    loadMore,
    handleImageSelect,
    removeImage,
    clearImages,
    handlePost,
    handleVote,
    toggleComments,
    submitComment,
    submitReply,
    deleteComment,
    confirmDeleteComment,
    startEditPost,
    saveEditPost,
    deletePost,
    confirmDeletePost,
    togglePin,
    jumpToPost,
    autoResize,
    handleComposerChange,
    insertMention,
    toggleReaction,
  } = useFeedActions();

  const pinnedItems = posts
    .filter((p) => p.isPinned)
    .map((p) => ({ id: p.id, title: p.title, authorName: p.author.displayName }));

  function renderContent(content: string) {
    const parts = content.split(/(@\[[^\|]+\|[^\]]+\])/g);
    return (
      <>
        {parts.map((part, i) => {
          const match = part.match(/^@\[([^\|]+)\|([^\]]+)\]$/);
          if (match) {
            const [, name, id] = match;
            return (
              <button
                key={i}
                type="button"
                onClick={() => router.push(`/employees/${id}`)}
                className="font-semibold text-blue-600 bg-blue-50 rounded-md px-1 py-0.5 hover:bg-blue-100 transition-colors cursor-pointer"
              >
                @{name}
              </button>
            );
          }
          return <React.Fragment key={i}>{part}</React.Fragment>;
        })}
      </>
    );
  }

  const firstName = user?.displayName?.split(" ")[0] ?? "there";

  return (
    // Capped so the feed reads at ~660px on wide screens instead of stretching
    // to fill the viewport (sidebar 300px + gap 20px + 660px feed = 980px).
    <div className="space-y-5 max-w-[980px] mx-auto">
      {/* Greeting */}
      <div>
        <p className="text-sm text-gray-500 font-medium">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
          {authLoading ? (
            <span className="inline-block h-8 w-48 bg-gray-100 animate-pulse rounded align-middle" />
          ) : (
            <>{getGreeting()}, {firstName}</>
          )}
        </h1>
      </div>

      {hasNewPosts && (
        <button
          onClick={() => { setHasNewPosts(false); load(activeFilter); }}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-command-black hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          New posts — click to refresh
        </button>
      )}

      {/* Two-column layout: compose+posts (left), sidebar (right). Stacks on mobile. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_1fr] items-start">

        {/* Sidebar — right column on desktop (spans both rows), last on mobile */}
        <aside className="order-last lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-8 space-y-4">

          {/* My Stats — compact strip on mobile, full card on desktop */}
          <div className="lg:hidden bg-white rounded-card border border-table-border px-4 py-3 flex items-center justify-between">
            {widgetsLoading ? (
              <div className="h-4 bg-gray-100 rounded animate-pulse w-32" />
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-navy-500 shrink-0" />
                  <span className="text-sm font-bold text-navy-600">Lv {profile?.level ?? 1}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-black text-gray-900 tabular-nums">{profile?.pointsBalance?.toLocaleString() ?? "—"}</span>
                  <span className="text-xs text-gray-500">pts</span>
                </div>
              </>
            )}
          </div>
          <div className="hidden lg:block bg-white rounded-card border border-table-border p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">My Stats</p>
            {widgetsLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-8 bg-gray-100 rounded w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-3xl font-black text-gray-900 tabular-nums leading-none">
                    {profile?.pointsBalance?.toLocaleString() ?? "—"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">points available</p>
                </div>
                <div className="flex items-center gap-4 pt-1 border-t border-gray-50">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-navy-500 shrink-0" />
                    <span className="text-sm font-bold text-navy-600">Lv {profile?.level ?? 1}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Feed Filters + Pinned */}
          <FeedSidebar
            activeFilter={activeFilter}
            onFilterChange={(value) => { setActiveFilter(value); setPosts([]); setNextCursor(null); }}
            pinned={pinnedItems}
            onJumpToPost={jumpToPost}
          />

          {/* Upcoming Birthdays */}
          {!widgetsLoading && birthdays.length > 0 && (
            <div className="bg-gradient-to-br from-rose-50 to-navy-50 border border-rose-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-rose-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5"><Cake className="w-3.5 h-3.5" aria-hidden="true" /> Birthdays</p>
              <div className="space-y-2">
                {birthdays.map((b) => (
                  <Link key={b.id} href={`/employees/${b.id}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <Avatar name={b.displayName} url={b.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900 truncate hover:underline">{b.displayName}</p>
                      <p className="text-[10px] text-gray-500">
                        {b.daysUntil === 0 ? "Today" : b.daysUntil === 1 ? "Tomorrow" : `In ${b.daysUntil} days`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Top Performers — desktop only; use /leaderboard on mobile */}
          <div className="hidden lg:block bg-white rounded-card border border-table-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-500" aria-hidden="true" />
                <span className="text-xs font-semibold text-gray-700">Top Performers</span>
              </div>
              <Link href="/leaderboard" className="text-xs text-navy-600 hover:text-navy-700 font-medium">See all →</Link>
            </div>
            {widgetsLoading ? (
              <div className="p-4 space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-gray-100 rounded" />)}
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">No data yet</p>
            ) : (
              <div>
                {leaderboard.slice(0, 5).map((entry) => (
                  <div key={entry.userId} className={`flex items-center gap-2.5 px-4 py-2.5 ${entry.isCurrentUser ? "bg-navy-50/50" : "hover:bg-gray-50/60"} transition-colors`}>
                    <Link href={`/employees/${entry.userId}`}>
                      <Avatar name={entry.displayName} url={entry.avatarUrl} size="sm" />
                    </Link>
                    <Link href={`/employees/${entry.userId}`} className={`text-xs font-medium truncate flex-1 min-w-0 hover:underline ${entry.isCurrentUser ? "text-navy-700 font-semibold" : "text-gray-700"}`}>
                      {entry.isCurrentUser ? `${entry.displayName} (You)` : entry.displayName}
                    </Link>
                    <span className="text-xs font-bold tabular-nums text-gray-500 shrink-0">
                      {entry.points.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions — desktop only; bottom nav covers these on mobile */}
          <div className="hidden lg:grid grid-cols-2 gap-2">
            <Link href="/minigames" className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-xl py-3 px-2 hover:border-gray-200 hover:shadow-sm transition-all text-center">
              <Gamepad2 className="w-5 h-5 text-navy-500" />
              <span className="text-xs font-semibold text-gray-700 leading-tight">Play a<br/>Minigame</span>
            </Link>
            <Link href="/marketplace" className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-xl py-3 px-2 hover:border-gray-200 hover:shadow-sm transition-all text-center">
              <ShoppingBag className="w-5 h-5 text-orange-400" />
              <span className="text-xs font-semibold text-gray-700 leading-tight">Redeem<br/>Points</span>
            </Link>
          </div>

        </aside>

        {/* Compose — left column, row 1 */}
        <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1">
      {/* Compose */}
      <div className="bg-white rounded-card border border-table-border p-4 overflow-hidden">
        {/* Collapsed trigger — click to expand */}
        {!composeExpanded && (
          <button
            type="button"
            onClick={() => setComposeExpanded(true)}
            className="flex items-center gap-3 w-full text-left"
            aria-label="Write a post"
          >
            <Avatar name={user?.displayName ?? "?"} url={user?.photoURL ?? null} size="md" />
            <span className="flex-1 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 hover:border-gray-300 hover:bg-white transition-all">
              What&apos;s on your mind?
            </span>
          </button>
        )}
        <form onSubmit={handlePost} className={composeExpanded ? "space-y-3" : "hidden"}>
          <div className="flex items-start gap-3">
            <Avatar name={user?.displayName ?? "?"} url={user?.photoURL ?? null} size="md" />
            <div className="flex-1 relative space-y-2">
              {!shoutoutMode && (
                <input
                  ref={titleInputRef}
                  type="text"
                  placeholder="Title *"
                  aria-label="Post title"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  maxLength={120}
                  className="w-full text-sm font-semibold bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 placeholder:font-normal transition-all"
                />
              )}
              {shoutoutMode && (
                <div ref={recipientSearchRef} className="space-y-1.5">
                  {recipients.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {recipients.map((r) => (
                        <div key={r.id} className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full pl-1.5 pr-2 py-0.5">
                          <Avatar name={r.displayName} url={r.avatarUrl} size="sm" />
                          <span className="text-xs font-medium text-amber-800">{r.displayName}</span>
                          <button type="button" aria-label={`Remove ${r.displayName}`} onClick={() => setRecipients((prev) => prev.filter((x) => x.id !== r.id))} className="text-amber-400 hover:text-amber-600 transition-colors ml-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <input
                      type="text"
                      value={recipientSearch}
                      onChange={(e) => { setRecipientSearch(e.target.value); setRecipientSearchOpen(true); }}
                      onFocus={() => setRecipientSearchOpen(true)}
                      placeholder={recipients.length === 0 ? "Who are you recognizing?…" : "Add another person…"}
                      className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/30 focus:border-amber-400 placeholder:text-gray-500 transition-all"
                    />
                    {recipientSearchOpen && (
                      <div role="listbox" aria-label="Select recipient" className="absolute z-30 top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {employees
                          .filter((e) => !recipients.some((r) => r.id === e.id) && (!recipientSearch || e.displayName.toLowerCase().includes(recipientSearch.toLowerCase())))
                          .slice(0, 8)
                          .map((e) => (
                            <button key={e.id} type="button"
                              role="option" aria-selected={false}
                              onMouseDown={(ev) => { ev.preventDefault(); setRecipients((prev) => [...prev, { id: e.id, displayName: e.displayName, avatarUrl: e.avatarUrl }]); setRecipientSearch(""); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-amber-50 text-left transition-colors">
                              <Avatar name={e.displayName} url={e.avatarUrl} size="sm" />
                              <span className="text-sm font-medium text-gray-900">{e.displayName}</span>
                            </button>
                          ))}
                        {employees.filter((e) => !recipients.some((r) => r.id === e.id) && (!recipientSearch || e.displayName.toLowerCase().includes(recipientSearch.toLowerCase()))).length === 0 && (
                          <p className="px-3 py-2 text-sm text-gray-500">{recipientSearch ? "No results" : "All employees added"}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {shoutoutMode && (
                <input
                  type="text"
                  placeholder="Recognition title (optional)"
                  value={shoutoutTitle}
                  onChange={(e) => setShoutoutTitle(e.target.value)}
                  maxLength={120}
                  className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/30 focus:border-amber-400 placeholder:text-gray-500 transition-all"
                />
              )}
              <textarea
                ref={composerRef}
                placeholder={shoutoutMode ? "What did they do that deserves recognition?" : "Share something with the team… (type @ to mention)"}
                aria-label="Post content"
                value={newPost}
                onChange={handleComposerChange}
                rows={2}
                className="w-full resize-none overflow-hidden text-sm bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all"
              />
              {mentionQuery !== null && mentionResults.length > 0 && (
                <div
                  ref={mentionDropdownRef}
                  role="listbox"
                  aria-label="Mention an employee"
                  className="absolute z-30 top-full left-0 mt-1 w-full max-w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
                >
                  {mentionResults.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => { e.preventDefault(); insertMention(emp); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 transition-colors text-left"
                    >
                      <Avatar name={emp.displayName} url={emp.avatarUrl} size="sm" />
                      <span className="text-sm font-medium text-gray-900">{emp.displayName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Image previews — shares PostImages' grid layout so composer and card never drift apart */}
          {imagePreviews.length > 0 && (() => {
            const { container: containerWidth, grid: gridClass } = imageGridClasses(imagePreviews.length);
            return (
              <div className={`${containerWidth} ${gridClass}`}>
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative group w-full aspect-square rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Preview ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Remove image"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-gray-900/70 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Flair picker */}
          {!shoutoutMode && <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Post type <span className="text-red-400 font-bold">*</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(showAllFlairs ? FLAIRS : FLAIRS.slice(0, 8)).map((flair) => (
                <button
                  key={flair.id}
                  type="button"
                  onClick={() => setSelectedFlair(flair.id === selectedFlair ? null : flair.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border transition-all ${
                    selectedFlair === flair.id
                      ? `${flair.color} scale-105 shadow-sm`
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span>{flair.emoji}</span>
                  <span>{flair.label}</span>
                </button>
              ))}
              {!showAllFlairs && (
                <button
                  type="button"
                  onClick={() => setShowAllFlairs(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-all"
                >
                  +{FLAIRS.length - 8} more
                </button>
              )}
            </div>
          </div>}

          {!shoutoutMode && dbUser?.department && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium shrink-0">Visible to:</span>
              <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDeptOnly(false)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    !deptOnly ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Everyone
                </button>
                <button
                  type="button"
                  onClick={() => setDeptOnly(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    deptOnly ? "bg-white text-navy-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Building2 className="w-3 h-3" aria-hidden="true" />
                  {dbUser.department.name} only
                </button>
              </div>
            </div>
          )}
          {shoutoutMode && dbUser?.department && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium shrink-0">Visible to:</span>
              <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setShoutoutDeptOnly(false)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    !shoutoutDeptOnly ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Everyone
                </button>
                <button
                  type="button"
                  onClick={() => setShoutoutDeptOnly(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    shoutoutDeptOnly ? "bg-white text-amber-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Building2 className="w-3 h-3" aria-hidden="true" />
                  {dbUser.department.name} only
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageFiles.length >= 4}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all bg-white border-gray-200 text-gray-600 hover:border-navy-300 hover:text-navy-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {imageFiles.length > 0 ? `${imageFiles.length}/4 photos` : "Photo"}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !pollMode;
                setPollMode(next);
                if (next) { setShoutoutMode(false); setRecipients([]); setRecipientSearch(""); }
                if (!next) setPollOptions(["", ""]);
              }}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                pollMode
                  ? "bg-command-black border-command-black text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-navy-300 hover:text-navy-600"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" /> Add Poll
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !shoutoutMode;
                setShoutoutMode(next);
                if (next) { setPollMode(false); setPollOptions(["", ""]); }
                else { setRecipients([]); setRecipientSearch(""); setShoutoutTitle(""); setShoutoutDeptOnly(false); }
              }}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                shoutoutMode
                  ? "bg-amber-500 border-amber-500 text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-amber-400 hover:text-amber-600"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Shoutout
            </button>
          </div>

          {pollMode && (
            <div className="space-y-2 pl-1">
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) =>
                      setPollOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                    }
                    className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                      className="text-gray-500 hover:text-red-500 text-sm transition-colors"
                      aria-label="Remove option"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={() => setPollOptions((prev) => [...prev, ""])}
                  className="text-xs text-navy-600 hover:text-navy-800 font-medium transition-colors"
                >
                  + Add option
                </button>
              )}
            </div>
          )}

          {(shoutoutMode ? recipients.length > 0 : (newPost.trim() || imageFiles.length > 0)) && (
            <div className="flex items-center justify-between">
              {shoutoutMode
                ? (recipients.length === 0 && <p className="text-xs text-red-400 font-medium">Choose a colleague to recognize</p>)
                : ((!postTitle.trim() || !selectedFlair) && (
                    <p className="text-xs text-red-400 font-medium">
                      {!postTitle.trim() ? "Add a title before posting" : "Pick a flair before posting"}
                    </p>
                  ))
              }
              <div className="ml-auto">
                <button
                  type="submit"
                  disabled={posting || (shoutoutMode ? recipients.length === 0 || !newPost.trim() : !postTitle.trim() || !selectedFlair || (pollMode && pollOptions.filter((o) => o.trim()).length < 2))}
                  className="flex items-center gap-2 bg-command-black text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  {uploading ? "Uploading…" : posting ? "Posting…" : shoutoutMode ? "Send Shoutout" : "Post"}
                </button>
                <button
                  type="button"
                  onClick={() => { setComposeExpanded(false); setNewPost(""); setPostTitle(""); setSelectedFlair(null); setShoutoutMode(false); setRecipients([]); setPollMode(false); setShowAllFlairs(false); clearImages(); }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
        </div>

        {/* Posts — left column, row 2 */}
        <div className="order-2 lg:order-none lg:col-start-1 lg:row-start-2 space-y-5">
      {/* Posts */}
      {loadError ? (
        <div role="alert" className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <p className="text-red-600 font-medium text-sm">{loadError}</p>
          <button onClick={() => load()} className="mt-3 text-xs text-red-500 underline hover:text-red-700">Try again</button>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-card border border-table-border p-5 animate-pulse">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <div className="mb-4 flex items-center justify-center"><Megaphone className="w-10 h-10 text-gray-300" /></div>
          <p className="text-gray-600 font-medium">No posts yet</p>
          <p className="text-gray-500 text-sm mt-1">Award points to an employee to generate the first post!</p>
        </div>
      ) : (
        posts.map((post) => {
          if (post.type === "SHOUTOUT" && post.shoutoutRecipients.length > 0) {
            return (
              <div id={`feed-post-${post.id}`} key={post.id} className={`bg-white rounded-card border overflow-hidden transition-shadow hover:shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 ${post.isPinned ? "border-amber-300 hover:border-amber-400" : "border-table-border hover:border-gray-300"}`}>
                <div className="h-1.5 bg-gradient-to-r from-amber-400 to-yellow-300" />
                <div className="px-5 pt-4 pb-4 space-y-3">
                  <PostHeader
                    authorId={post.authorId}
                    authorName={post.author.displayName}
                    authorAvatarUrl={post.author.avatarUrl}
                    department={post.author.department?.name}
                    createdAt={post.createdAt}
                    isPinned={post.isPinned}
                    canPin={dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN"}
                    canEdit={post.authorId === dbUser?.id || dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN"}
                    canDelete={post.authorId === dbUser?.id || dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN"}
                    onAuthorClick={(id) => router.push(`/employees/${id}`)}
                    onPin={() => togglePin(post.id)}
                    onEdit={() => startEditPost(post)}
                    onDelete={() => deletePost(post.id)}
                    editLabel="Edit shoutout"
                  />

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-amber-200" />
                    <span className="text-xs font-semibold text-amber-600 flex items-center gap-1 shrink-0">
                      <Sparkles className="w-3.5 h-3.5" /> gave a shoutout to
                    </span>
                    <div className="h-px flex-1 bg-amber-200" />
                  </div>

                  {/* Title + department badge */}
                  {(post.title || post.department) && (
                    <div className="flex flex-col items-center gap-1.5">
                      {post.title && (
                        <p className="text-sm font-bold text-amber-800 text-center">{post.title}</p>
                      )}
                      {post.department && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          <Building2 className="w-2.5 h-2.5" aria-hidden="true" /> {post.department.name} only
                        </span>
                      )}
                    </div>
                  )}

                  {/* Recipients + message */}
                  {editingPost?.id === post.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingPost.content}
                        onChange={(e) => { setEditingPost((prev) => (prev ? { ...prev, content: e.target.value } : prev)); autoResize(e.target); }}
                        rows={3}
                        maxLength={500}
                        className="w-full resize-none overflow-hidden text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/30 focus:border-amber-400 placeholder:text-gray-500 transition-all"
                      />
                      <div className="flex items-center gap-2">
                        <button onClick={() => saveEditPost(post)} disabled={savingPostEdit || !editingPost.content.trim()} className="flex items-center gap-1.5 bg-command-black text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button onClick={() => setEditingPost(null)} className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1.5 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : post.shoutoutRecipients.length === 1 ? (
                    <div className="flex gap-3 items-start">
                      <button type="button" onClick={() => router.push(`/employees/${post.shoutoutRecipients[0].user.id}`)} className="shrink-0 hover:opacity-80 transition-opacity">
                        <Avatar name={post.shoutoutRecipients[0].user.displayName} url={post.shoutoutRecipients[0].user.avatarUrl} size="md" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <button type="button" onClick={() => router.push(`/employees/${post.shoutoutRecipients[0].user.id}`)} className="font-bold text-base text-gray-900 hover:underline block">
                          {post.shoutoutRecipients[0].user.displayName}
                        </button>
                        <p className="text-sm text-gray-600 italic mt-1 leading-relaxed whitespace-pre-wrap">&ldquo;{renderContent(post.content)}&rdquo;</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {post.shoutoutRecipients.map((r) => (
                          <button key={r.user.id} type="button" onClick={() => router.push(`/employees/${r.user.id}`)} className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-full pl-0.5 pr-2.5 py-0.5 hover:bg-amber-100 transition-colors">
                            <Avatar name={r.user.displayName} url={r.user.avatarUrl} size="sm" />
                            <span className="text-xs font-semibold text-amber-900">{r.user.displayName}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-sm text-gray-600 italic leading-relaxed whitespace-pre-wrap">&ldquo;{renderContent(post.content)}&rdquo;</p>
                    </div>
                  )}
                </div>

                {post.imageUrls?.length > 0 && (
                  <PostImages urls={post.imageUrls} authorName={post.author.displayName} onOpen={(index) => setLightbox({ images: post.imageUrls, index })} />
                )}

                <div className="px-5 pt-3 pb-4">
                  <PostEngagement
                    postId={post.id}
                    reactions={post.reactions}
                    myReactions={post.myReactions}
                    commentCount={post.commentCount}
                    commentsOpen={!!openComments[post.id]}
                    onReact={toggleReaction}
                    onToggleComments={() => toggleComments(post.id)}
                  />
                  {openComments[post.id] && (
                    <CommentThread
                      postId={post.id}
                      comments={commentsCache[post.id] ?? []}
                      loading={!!commentsLoading[post.id]}
                      replyingTo={replyingTo}
                      replyDraft={replyDraft}
                      replySending={replySending}
                      expandedReplies={expandedReplies}
                      commentDraft={commentDraft}
                      commentSending={commentSending}
                      currentUserName={user?.displayName ?? "?"}
                      currentUserAvatar={user?.photoURL ?? null}
                      dbUserId={dbUser?.id}
                      isModerator={dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN"}
                      onSetReplyingTo={setReplyingTo}
                      onReplyDraftChange={(commentId, value) => setReplyDraft((prev) => ({ ...prev, [commentId]: value }))}
                      onSubmitReply={submitReply}
                      onToggleExpandedReplies={(commentId) => setExpandedReplies((prev) => ({ ...prev, [commentId]: !prev[commentId] }))}
                      onDeleteComment={deleteComment}
                      onCommentDraftChange={(pid, value) => setCommentDraft((prev) => ({ ...prev, [pid]: value }))}
                      onSubmitComment={submitComment}
                      autoResize={autoResize}
                      wrapperClassName="mt-3 pt-3 border-t border-black/5 space-y-4"
                    />
                  )}
                </div>
              </div>
            );
          }

          return (
            <div id={`feed-post-${post.id}`} key={post.id} className={`rounded-card border overflow-hidden bg-white transition-shadow hover:shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 ${post.isPinned ? "border-amber-300 hover:border-amber-400" : "border-table-border hover:border-gray-300"}`}>
              <div className="p-4 sm:p-5">
                <PostHeader
                  authorId={post.authorId}
                  authorName={post.author.displayName}
                  authorAvatarUrl={post.author.avatarUrl}
                  department={post.author.department?.name}
                  createdAt={post.createdAt}
                  isPinned={post.isPinned}
                  canPin={dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN"}
                  canEdit={post.authorId === dbUser?.id || dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN"}
                  canDelete={post.authorId === dbUser?.id || dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN"}
                  onAuthorClick={(id) => router.push(`/employees/${id}`)}
                  onPin={() => togglePin(post.id)}
                  onEdit={() => startEditPost(post)}
                  onDelete={() => deletePost(post.id)}
                />

                <PostBadges flairId={post.flair} isPoll={post.type === "POLL"} departmentName={post.department?.name} />

                {editingPost?.id === post.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingPost.title}
                      onChange={(e) => setEditingPost((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                      maxLength={120}
                      placeholder="Title *"
                      className="w-full text-sm font-semibold bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus:border-navy-400 placeholder:font-normal placeholder:text-gray-500 transition-all"
                    />
                    <textarea
                      value={editingPost.content}
                      onChange={(e) => { setEditingPost((prev) => (prev ? { ...prev, content: e.target.value } : prev)); autoResize(e.target); }}
                      rows={3}
                      className="w-full resize-none overflow-hidden text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 focus:border-navy-400 placeholder:text-gray-500 transition-all"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveEditPost(post)}
                        disabled={savingPostEdit || !editingPost.content.trim() || !editingPost.title.trim()}
                        className="flex items-center gap-1.5 bg-command-black text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Check className="w-3.5 h-3.5" /> Save
                      </button>
                      <button
                        onClick={() => setEditingPost(null)}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1.5 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1">
                    {post.title && (
                      <p className="text-base font-bold text-gray-900 leading-snug">{post.title}</p>
                    )}
                    <ExpandableText className="text-sm text-gray-700 mt-1 leading-relaxed whitespace-pre-wrap">
                      {renderContent(post.content)}
                    </ExpandableText>
                  </div>
                )}

                {post.type === "POLL" && post.pollOptions.length > 0 && (
                  <PollBlock
                    postId={post.id}
                    options={post.pollOptions}
                    myVoteOptionId={post.myVoteOptionId}
                    voting={votingPost === post.id}
                    onVote={handleVote}
                  />
                )}
              </div>

              {post.imageUrls?.length > 0 && (
                <PostImages
                  urls={post.imageUrls}
                  authorName={post.author.displayName}
                  onOpen={(index) => setLightbox({ images: post.imageUrls, index })}
                />
              )}

              <div className="px-4 sm:px-5 pt-3 pb-4 sm:pb-5">
                <PostEngagement
                  postId={post.id}
                  reactions={post.reactions}
                  myReactions={post.myReactions}
                  commentCount={post.commentCount}
                  commentsOpen={!!openComments[post.id]}
                  onReact={toggleReaction}
                  onToggleComments={() => toggleComments(post.id)}
                />

                {openComments[post.id] && (
                  <CommentThread
                    postId={post.id}
                    comments={commentsCache[post.id] ?? []}
                    loading={!!commentsLoading[post.id]}
                    replyingTo={replyingTo}
                    replyDraft={replyDraft}
                    replySending={replySending}
                    expandedReplies={expandedReplies}
                    commentDraft={commentDraft}
                    commentSending={commentSending}
                    currentUserName={user?.displayName ?? "?"}
                    currentUserAvatar={user?.photoURL ?? null}
                    dbUserId={dbUser?.id}
                    isModerator={dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN"}
                    onSetReplyingTo={setReplyingTo}
                    onReplyDraftChange={(commentId, value) => setReplyDraft((prev) => ({ ...prev, [commentId]: value }))}
                    onSubmitReply={submitReply}
                    onToggleExpandedReplies={(commentId) => setExpandedReplies((prev) => ({ ...prev, [commentId]: !prev[commentId] }))}
                    onDeleteComment={deleteComment}
                    onCommentDraftChange={(pid, value) => setCommentDraft((prev) => ({ ...prev, [pid]: value }))}
                    onSubmitComment={submitComment}
                    autoResize={autoResize}
                    wrapperClassName="mt-3 pt-3 border-t border-black/5 space-y-4"
                  />
                )}
              </div>
            </div>
          );
        })
      )}

      {!loading && nextCursor && (
        <div className="flex justify-center pt-2">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loadingMore ? "Loading…" : "Load more posts"}
          </button>
        </div>
      )}
        </div>
      </div>

      {/* ── Lightbox (shared component, supports prev/next + keyboard) ── */}
      <ImageLightbox
        images={lightbox?.images ?? []}
        initialIndex={lightbox?.index ?? 0}
        open={lightbox !== null}
        onClose={() => setLightbox(null)}
      />

      {/* ── Post error toast ── */}
      {postToast && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-red-50 text-red-800 border border-red-200 shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-200"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          {postToast}
        </div>
      )}

      <AlertDialog open={commentDeleteTarget !== null} onOpenChange={(next) => { if (!next) setCommentDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction autoFocus variant="destructive" onClick={confirmDeleteComment}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={postDeleteTarget !== null} onOpenChange={(next) => { if (!next) setPostDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction autoFocus variant="destructive" onClick={confirmDeletePost}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
