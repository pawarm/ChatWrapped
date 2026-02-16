/**
 * Classifies Meta Messenger messages into special types for display and analytics.
 * Patterns are based on content strings; Meta exports use the user's locale.
 */

export type SpecialType =
  | 'group_event'
  | 'poll_creation'
  | 'poll_vote'
  | 'live_location'
  | 'share'
  | 'edited'
  | 'generic';

export interface MessageInput {
  content?: string | null;
  type?: string;
  share?: unknown;
}

// Group events: named the group, added/removed/left
const GROUP_EVENT =
  /named the group|added .+ to the group|added you to the group|removed .+ from the group|left the group|A contact left the group/i;

// Poll creation
const POLL_CREATION = /created a poll:/i;

// Poll votes
const POLL_VOTE =
  /voted for .+ in the poll|changed their vote to|removed their vote for/i;

// Live location
const LIVE_LOCATION = /sent a live location/i;

// Edited suffix
const EDITED = / \(edited\)$/;

/**
 * Classifies a message into a special type for display and analytics filtering.
 * Order matters: more specific patterns are checked first.
 */
export function classifySpecialMessage(msg: MessageInput): SpecialType {
  const content = msg.content ?? '';
  const hasShare = msg.share != null && typeof msg.share === 'object';

  // Share: has share object (link/share_text from Meta)
  if (hasShare) {
    return 'share';
  }

  // Group events
  if (GROUP_EVENT.test(content)) {
    return 'group_event';
  }

  // Poll creation (before poll vote, so "created a poll" is not misclassified)
  if (POLL_CREATION.test(content)) {
    return 'poll_creation';
  }

  // Poll votes
  if (POLL_VOTE.test(content)) {
    return 'poll_vote';
  }

  // Live location
  if (LIVE_LOCATION.test(content)) {
    return 'live_location';
  }

  // Edited: content ends with " (edited)" — can co-occur with other types,
  // but we treat it as primary only when nothing else matches
  if (EDITED.test(content)) {
    return 'edited';
  }

  return 'generic';
}

/**
 * Message types that should typically be excluded from word-frequency and
 * content analytics (system/automated messages).
 */
export const ANALYTICS_EXCLUDE_TYPES: SpecialType[] = [
  'group_event',
  'poll_creation',
  'poll_vote',
  'live_location',
];
