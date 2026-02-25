# ChatWrapped — UI Feature Map

How planned features map to the user interface. Organized around **what the user sees and does**, not technical phases.

For the full technical roadmap, see [FUTURE_PLANS.md](./FUTURE_PLANS.md).

---

## Navigation Structure

The app expands from 3 pages to **5 primary views** plus a settings area. Each view answers a distinct question the user has in mind:

| View | Question it answers | Status |
|---|---|---|
| **Dashboard** | "What's the big picture?" | Exists (basic), evolves |
| **Conversations** | "What did we talk about?" | Exists, gains analytics |
| **People** | "How is my relationship with X?" | New |
| **Insights** | "What are my communication patterns?" | New |
| **Memories** | "Remember when...?" | New |
| **Settings / Import** | "How do I manage my data?" | Exists (Import page), evolves |

The sidebar navigation grows from 3 items to 5 (Import moves into a settings area accessible from the Dashboard or a gear icon, since it's a one-time onboarding action rather than a regular destination).

```
Sidebar (48px)              Main Content
+-----------+  +------------------------------------------+
| Dashboard |  |                                          |
| Convo     |  |   (active view renders here)             |
| People    |  |                                          |
| Insights  |  |                                          |
| Memories  |  |                                          |
|           |  |                                          |
|   [gear]  |  |                                          |
+-----------+  +------------------------------------------+
```

---

## 1. Dashboard

**Purpose**: At-a-glance overview of your entire messaging history. The first thing you see after import.

**Current state**: `HomePage.tsx` shows 5 stat cards (conversations, messages, reactions, words, date range) and links to Import / Conversations.

### Layout

```
+--------------------------------------------------+
|  Welcome to ChatWrapped                          |
|  "Your messages at a glance"                     |
+--------------------------------------------------+
|                                                  |
|  [Conversations] [Messages] [Reactions] [Words]  |  <- stat cards (exists)
|  [Date Range .................................]  |
|                                                  |
|  +--------------------+  +--------------------+  |
|  | Activity Heatmap   |  | Messages Over Time |  |  <- new charts
|  | (day x hour grid)  |  | (monthly timeline) |  |
|  +--------------------+  +--------------------+  |
|                                                  |
|  +--------------------+  +--------------------+  |
|  | Top Contacts       |  | On This Day        |  |  <- new cards
|  | 1. Anna  12,340    |  | 3 years ago you    |  |
|  | 2. Mark   8,102    |  | sent 47 messages   |  |
|  | 3. Sarah  5,891    |  | to Anna about...   |  |
|  +--------------------+  +--------------------+  |
|                                                  |
|  +--------------------------------------------+  |
|  | Badges & Achievements                       |  |  <- gamification
|  | [Night Owl] [Emoji Addict] [The Initiator]  |  |
|  +--------------------------------------------+  |
|                                                  |
+--------------------------------------------------+
```

### Features by Tier

**Foundation** (what to build first):
- Stat cards — exists, keep as-is
- Activity heatmap — day-of-week x hour-of-day grid, colored by message density
- Messages over time — monthly bar/area chart showing volume trends
- Top contacts — ranked list of most-messaged people, clickable (navigates to People view)

**Enhanced**:
- "On this day" teaser card — a single memory surfaced daily, links to Memories view
- Badges showcase — earned badges displayed as icons with tooltips (Night Owl, Emoji Addict, The Ghost, The Reactor, The Initiator)
- Longest active streak — highlight your current/best streak
- Quick date range selector — filter the entire dashboard to a year or custom range

**Advanced**:
- Mood trend sparkline — small chart showing emotional tone over recent months
- Sleep pattern indicator — estimated sleep/wake times derived from first/last message
- Digital dependency score — single metric summarizing messaging intensity

### User Actions

- Click a top contact to navigate to their People profile
- Click "On this day" card to open Memories
- Click a badge to see how it was earned
- Click the heatmap to drill into a specific day/hour in Conversations

---

## 2. Conversations

**Purpose**: Browse, search, and read message threads. The core reading experience.

**Current state**: `ConversationsPage.tsx` has a thread list sidebar (280px) with search/sort, and a main message view with the `JumpToDateBar` histogram and virtualized `MessageView`.

### Layout

The existing two-panel layout stays. A new collapsible **thread stats panel** is added to the right or as a slide-over.

```
+-------------+----------------------------------+-----------+
| Thread List  |  Message View                    | Stats     |
|             |                                  | Panel     |
| [Search...] |  +----------------------------+  | (toggle)  |
| [Msg search]|  | JumpToDateBar (histogram)  |  |           |
| [Recent|Name]| +----------------------------+  | Messages  |
|             |  |                              |  | 12,340    |
| > Anna      |  |  Anna: Hey!                 |  |           |
|   8,102 msgs|  |  You: What's up?            |  | Words     |
|             |  |  Anna: Check this out [img] |  | 89,200    |
| > Work Group|  |  You: Nice! [reaction: ❤️]   |  |           |
|   3,450 msgs|  |                              |  | Top emoji |
|             |  |  ...                         |  | 😂 ❤️ 👍  |
| > Mark      |  |                              |  |           |
|   2,100 msgs|  |                              |  | Entropy   |
|             |  |                              |  | ████░ 0.7 |
+-------------+----------------------------------+-----------+
```

### Features by Tier

**Foundation** (improvements to existing view):
- Full-text search (FTS5) — replace current `LIKE`-based message search with SQLite FTS5
- Search result highlighting — bold matched terms in the message view
- Search filters — filter by sender, date range within a thread
- Media gallery — grid view of all photos/videos in a conversation, accessible via a toolbar button
- Keyboard shortcuts — arrow keys to navigate thread list, `/` to focus search, `Esc` to deselect

**Enhanced**:
- Thread stats panel — collapsible side panel showing per-conversation metrics:
  - Total messages, words, media count
  - Participant breakdown (who sent how many)
  - Most used emojis in this thread
  - Activity heatmap scoped to this conversation
  - Date of first and last message
- Conversation-specific timeline — activity over time chart embedded in the stats panel
- Sort by more criteria — by message count, by date of first message, by unread (if supported)

**Advanced**:
- Conversation entropy indicator — small badge or meter showing how varied/predictable the conversation is
- Emotional tone indicator — color-coded subtle background shift or icon based on sentiment analysis
- Per-conversation circadian rhythm — when does this specific chat tend to be active?
- AI-powered thread summary — one-paragraph TL;DR of the conversation (local LLM)
- Conversation movie — animated playback of message density over time, accessible from the stats panel

### User Actions

- Search conversations by name (exists) and messages by content (exists)
- Select a thread to read messages (exists)
- Jump to a date via the histogram bar (exists)
- Toggle the stats panel to see per-conversation analytics
- Open the media gallery to browse shared photos/videos
- Click a participant name in the stats panel to navigate to their People profile

---

## 3. People

**Purpose**: Understand your relationship with a specific person. Aggregates data across all threads (1:1 and shared groups) for a single participant.

**Current state**: Does not exist. This is the main new view.

### Layout

Mirrors the Conversations page structure for consistency: person list on the left, person detail on the right.

```
+-------------+--------------------------------------------------+
| Person List  |  Person Detail                                   |
|             |                                                  |
| [Search...] |  Anna Kowalski                                   |
| [Sort: msgs]|  "Your #1 contact since 2016"                    |
|             |                                                  |
| > Anna    ● |  +----------------------------------------------+|
|   12,340    |  | Overview                                      ||
|   last: 2d  |  |                                              ||
|             |  | Messages    Response Time   You Initiate     ||
| > Mark      |  | 12,340      ~4 min avg      62% of the time  ||
|   8,102     |  |                                              ||
|   last: 1w  |  | Streak: 847 days   Peak Year: 2021           ||
|             |  +----------------------------------------------+|
| > Sarah     |  |                                              ||
|   5,891     |  | [Activity] [Dynamics] [Language] [Threads]   ||
|   last: 3mo |  |                                              ||
|             |  |  Activity Tab:                               ||
|  ·····      |  |  +------ Monthly Messages Over Time ------+  ||
|             |  |  |  ▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁              |  ||
|  (dormant)  |  |  +--------------------------------------+  ||
|  > Old Friend| |                                              ||
|    120      |  |  +------ Day x Hour Heatmap ------+         ||
|    last: 2y |  |  |  (when do you two talk?)       |         ||
|             |  |  +--------------------------------+         ||
+-------------+--------------------------------------------------+
```

### Features by Tier

**Foundation** (the minimum viable People view):
- Person list — all unique `sender_name` values across all threads, deduplicated
  - Total message count per person (sent + received across all threads)
  - Last message date
  - Sort by: message count, most recent, alphabetical
  - Search/filter
- Person overview card — at the top of the detail panel:
  - Total messages exchanged
  - Number of threads they appear in (1:1 and groups)
  - Date of first and last message
  - Ranking ("Your #3 most-messaged contact")
- Threads list tab — all conversations this person appears in, with per-thread message counts, clickable to navigate to Conversations view

**Enhanced**:
- Activity timeline — monthly message volume chart for this person over time
- Activity heatmap — when do you talk to this person? (day x hour)
- Response dynamics card:
  - Average response time (yours to them, theirs to you)
  - Who initiates conversations more often (initiation ratio)
  - Who double-texts more
  - Who tends to end conversations
- Friendship trajectory — trend indicator: warming, stable, cooling, dormant
  - Peak friendship period ("Peak year: 2021")
  - Current trend direction
- Streak tracking — longest and current consecutive-day streak

**Advanced**:
- Relationship strength score — composite metric combining frequency, response speed, length, reactions
- Emoji compatibility — side-by-side comparison of your emoji usage vs theirs in shared conversations
- Reaction reciprocity — who reacts more, reaction symmetry score
- Shared vocabulary — words/phrases unique to conversations with this person
- Persona comparison — how your writing style changes when talking to this person vs others
- Social role indicator — your role in this relationship (Initiator, Supporter, Listener, Joker)
- Friendship decay visualization — if activity has dropped significantly, show the decay curve
- Compatibility report (mutual import) — if both users import data, compare communication styles

### User Actions

- Browse person list, search by name, sort by different criteria
- Select a person to see their full profile
- Switch between tabs (Activity, Dynamics, Language, Threads)
- Click a thread in the Threads tab to jump to that conversation in the Conversations view
- Click "Peak year" or a timeline point to jump to that period in Memories

---

## 4. Insights

**Purpose**: Understand your own communication patterns, language, and behavior. Self-focused analytics that look across all conversations.

**Current state**: Does not exist.

### Layout

Card-based dashboard with sections. No list/detail split — this is a single scrollable or tabbed view.

```
+----------------------------------------------------------+
|  Insights                                                |
|  "Your communication patterns"                           |
|                                                          |
|  [Overview]  [Language]  [Social Graph]  [Lifestyle]     |
|                                                          |
|  Overview Tab:                                           |
|  +------------------------+  +-----------------------+   |
|  | Circadian Profile      |  | Your Communication    |   |
|  |                        |  | Style                 |   |
|  | ████░░░░░░░▒▒▓███████  |  |                       |   |
|  | 00  04  08  12  16  20 |  | Night Owl Index: 7.2  |   |
|  |                        |  | Avg msg length: 12w   |   |
|  | Night Owl Index: 7.2   |  | Emoji rate: 23%       |   |
|  +------------------------+  +-----------------------+   |
|                                                          |
|  +------------------------+  +-----------------------+   |
|  | Weekday vs Weekend     |  | Seasonal Patterns     |   |
|  | (side-by-side heatmap) |  | (4-season comparison) |   |
|  +------------------------+  +-----------------------+   |
|                                                          |
|  +--------------------------------------------------+   |
|  | Mood Over Time                                    |   |
|  | (emoji sentiment trend line across years)         |   |
|  +--------------------------------------------------+   |
|                                                          |
+----------------------------------------------------------+
```

### Features by Tier

**Foundation** (first cards to build):
- Circadian messaging profile — 24-hour bar chart of your messaging activity
- Weekday vs weekend comparison — side-by-side activity patterns
- Night owl index — single metric quantifying late-night tendency
- Communication style summary — average message length, emoji usage rate, media sharing frequency

**Enhanced**:
- Seasonal variation — how your messaging behavior changes across seasons
- Emoji personality map — your emoji fingerprint: which categories you favor (affection, humor, celebration, etc.)
- Contextual emoji usage — how your emoji choices shift by time-of-day or contact
- Vocabulary growth chart — unique words per year, lexical diversity trend
- Slang evolution timeline — when you adopted/dropped specific phrases, phrase half-life
- Code switching detection — if multilingual, how you shift between languages across contacts
- Mood cycles — emotional tone tracked across years via emoji sentiment and keyword scoring

**Advanced**:
- Social graph visualization — interactive node graph of all your contacts
  - Node size = message volume, edge thickness = relationship strength
  - Clusters emerge naturally (school friends, work, family)
  - Clickable nodes navigate to People view
- Social circle evolution — animated or slider-based view showing how your social clusters changed over years
- Linguistic stylometry — how your writing style has matured over time (complexity, structure)
- Personal language model output — your linguistic fingerprint, unique phrases, tone profile
- Communication DNA — a compact multi-metric fingerprint encoding your behavior
- Sleep estimation — inferred sleep/wake times from messaging gaps
- Digital dependency score — how much of your day involves messaging

### User Actions

- Switch between tabs (Overview, Language, Social Graph, Lifestyle)
- Hover over charts for detail tooltips
- Click a node in the social graph to navigate to that person's People profile
- Click a time period in any chart to see conversations from that period
- Adjust date range to focus on a specific year or era

---

## 5. Memories

**Purpose**: Nostalgia and storytelling. Resurface old conversations and generate narrative recaps.

**Current state**: Does not exist.

### Layout

A vertical, card-based "feed" optimized for browsing and exploration. No sidebar — full-width immersive content.

```
+----------------------------------------------------------+
|  Memories                                                |
|  "Look back on your conversations"                       |
|                                                          |
|  [On This Day]  [Year Wrapped]  [Timeline]               |
|                                                          |
|  On This Day Tab:                                        |
|  +--------------------------------------------------+   |
|  | February 22, 2023 — 3 years ago                   |   |
|  |                                                    |   |
|  | You exchanged 47 messages with Anna about a        |   |
|  | weekend trip. Mark sent you a funny video.          |   |
|  |                                                    |   |
|  | [View conversation ->]                             |   |
|  +--------------------------------------------------+   |
|                                                          |
|  +--------------------------------------------------+   |
|  | February 22, 2021 — 5 years ago                   |   |
|  |                                                    |   |
|  | Your most active day ever with the Work Group      |   |
|  | chat — 312 messages!                               |   |
|  |                                                    |   |
|  | [View conversation ->]                             |   |
|  +--------------------------------------------------+   |
|                                                          |
|  +--------------------------------------------------+   |
|  | Your longest conversation streak                  |   |
|  | 847 consecutive days with Anna                    |   |
|  | Aug 2019 — Dec 2021                               |   |
|  +--------------------------------------------------+   |
|                                                          |
+----------------------------------------------------------+
```

### Features by Tier

**Foundation** (minimum viable Memories view):
- "On this day" cards — show what happened on today's date in previous years
  - Number of messages sent, who you talked to, which threads were active
  - Link to jump to that conversation in the Conversations view
- Milestones list — key records surfaced automatically:
  - Your most active day ever
  - Your longest conversation
  - Your quietest month
  - First message in the database

**Enhanced**:
- Year Wrapped — full-screen, step-by-step narrative recap for a selected year:
  - Total messages, top contacts, most active month
  - Most used emoji, most emotional conversation
  - Longest streak, new contacts that year
  - Exportable as PDF
- Timeline browser — scrollable timeline showing message volume per month with notable events highlighted
- "Most intense month ever" — surfaced proactively with context
- Memory cards for specific relationship milestones (first message with someone, 1000th message, etc.)

**Advanced**:
- Conversation movie — animated visualization of message density over time
  - Play/pause controls, speed adjustment
  - Highlight reaction bursts and activity spikes
  - Can be scoped to a single person or all conversations
- AI-generated memory narratives — short paragraph summaries of significant periods (local LLM)
- Export options:
  - PDF story — Year Wrapped as a printable document
  - HTML export — shareable stats page
  - Anonymized recap — names redacted for sharing publicly

### User Actions

- Browse "On this day" cards (auto-generated daily)
- Select a year to generate Year Wrapped
- Scroll the timeline, click a month to explore
- Play the conversation movie
- Export Year Wrapped or specific memories as PDF/HTML
- Click any memory card to jump to that conversation in the Conversations view

---

## 6. Settings / Import

**Purpose**: Data management, preferences, and onboarding.

**Current state**: `ImportPage.tsx` handles ZIP selection, inspection, import progress, and data clearing.

### Layout

Moved out of main navigation into a settings area (gear icon at bottom of sidebar). Combines import with app preferences.

```
+----------------------------------------------------------+
|  Settings                                                |
|                                                          |
|  Data                                                    |
|  +--------------------------------------------------+   |
|  | Import Messenger Data                             |   |
|  | [Select ZIP file]                                 |   |
|  | Storage: 1.2 GB used                              |   |
|  | [Clear all data]                                  |   |
|  +--------------------------------------------------+   |
|                                                          |
|  Preferences                                             |
|  +--------------------------------------------------+   |
|  | Theme: [Light | Dark | System]                    |   |
|  | Language: [English v]                             |   |
|  +--------------------------------------------------+   |
|                                                          |
|  Export                                                   |
|  +--------------------------------------------------+   |
|  | [Export communication profile report]             |   |
|  | [Export anonymized research dataset]              |   |
|  | [Export personal archive snapshot]                |   |
|  +--------------------------------------------------+   |
|                                                          |
+----------------------------------------------------------+
```

### Features by Tier

**Foundation**:
- Import flow — exists, keep as-is
- Clear data — exists, keep as-is
- Storage size display — exists, keep as-is

**Enhanced**:
- Incremental import — re-import without overwriting, merge new messages
- Multi-export support — combine exports from different dates
- Dark mode toggle
- Cross-platform import — WhatsApp, Telegram, Instagram, Discord, SMS parsers

**Advanced**:
- Privacy-first export — generate personal communication profile report, anonymized datasets, archive snapshots
- Accessibility settings — high contrast mode, screen reader support
- Internationalization — language selector

---

## Cross-Cutting Concerns

These apply across all views and should be designed as shared patterns.

### Progressive Disclosure

To avoid overwhelming users with analytics they haven't asked for:

1. **Empty data handling** — views that need computed analytics (Insights, People, Memories) only appear in the sidebar after data is imported and initial analysis is computed
2. **Tiered complexity** — each view starts with a simple summary at the top; detailed analytics are in tabs, expandable sections, or behind "show more" actions
3. **Contextual hints** — brief explanations on analytics cards ("What is this?" tooltips) for concepts like entropy, night owl index, or friendship decay

### Navigation Patterns

- **Cross-view linking** — People, Conversations, and Memories are deeply interlinked:
  - Clicking a person name anywhere navigates to their People profile
  - Clicking a conversation reference navigates to that thread in Conversations
  - Clicking a date/period navigates to that moment in the timeline
- **Breadcrumb context** — when navigating from one view to another (e.g., People -> Conversations), show a "back to" link to return

### Date Range Filtering

A global or per-view date range control that filters all displayed data to a specific period. Useful for comparing eras ("college years" vs "post-graduation") without dedicated UI for each.

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `1`-`5` | Switch between main views |
| `/` | Focus search in the current view |
| `Esc` | Deselect / close panel |
| Arrow keys | Navigate lists (threads, people) |
| `Enter` | Open selected item |

### Theming

- Light / dark / system preference
- Consistent color palette for charts across all views
- Accent colors for sentiment (positive = warm, negative = cool) used consistently in emotional analytics

---

## Data Prerequisites

New backend work needed to support the UI views above.

### People View (critical path)

The current schema has no `participants` table. Participant names exist only as:
- `sender_name` on each message row
- `participants_json` (JSON array) on each thread row

To power the People view efficiently:

1. **Materialized participants table** — a `participants` table (or view) that aggregates unique sender names with per-person stats (total messages, first/last message, thread count)
2. **Per-person queries** — new Tauri commands: `get_participants(search, sort)`, `get_participant_stats(name)`, `get_participant_threads(name)`
3. **Name deduplication** — strategy for handling slight name variations (e.g., "Anna Kowalski" vs "Anna")

### Analytics Engine

Most analytics features (heatmaps, response dynamics, entropy, sentiment) require computed aggregates that are expensive to calculate on every page load:

1. **Precomputed analytics tables** — store computed metrics (hourly activity, response times, emoji counts) in dedicated SQLite tables, refreshed on import
2. **Analytics Tauri commands** — new commands for each analytics query, returning chart-ready data structures
3. **Incremental recomputation** — when new data is imported, update analytics incrementally rather than recomputing everything

### Charting Library

All views with charts need a shared charting solution. Candidates: Recharts, Visx, or Tremor. Decision should be made once before building any chart-dependent features.

---

## Recommended Build Order

Based on the view dependencies and user value:

| Step | What to build | Why first |
|---|---|---|
| 1 | Dashboard charts (heatmap, timeline, top contacts) | Immediate visual impact on the existing home page |
| 2 | Conversations stats panel | Adds analytics to the existing core view without new navigation |
| 3 | People view (foundation tier) | The highest-value new view; requires participants table backend work |
| 4 | Insights view (foundation tier) | Circadian profile and style summary; reuses chart components from step 1 |
| 5 | Memories view (foundation tier) | "On this day" and milestones; high delight factor |
| 6 | Enhanced tiers across all views | Response dynamics, emoji maps, Year Wrapped, social graph |
| 7 | Advanced tiers | AI features, conversation movie, compatibility, experimental |

---

## Reference

- [FUTURE_PLANS.md](./FUTURE_PLANS.md) — Full technical roadmap with phases
