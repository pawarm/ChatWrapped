# ChatWrapped — Future Plans

A roadmap of planned features and improvements for ChatWrapped.

**Vision**: Move from "fun stats" to a **Personal Communication Intelligence Dashboard** — behavioral modeling, social graph analysis, and linguistic identity, all local and private.

**Guiding principle**: *"Understand how you communicate and how your relationships evolve over time."*

---

## Priority Matrix

| Feature Area | Impact | Difficulty | Phase |
|---|---|---|---|
| Search & UX Polish | Medium | Low | 1 |
| Data Management (incremental import) | Medium | Medium | 1 |
| Core Analytics (heatmaps, word freq, emoji stats) | High | Low–Medium | 2 |
| Behavioral Analytics (circadian, response dynamics) | High | Medium | 3 |
| Conversation Entropy & Emotional Modeling | High | Medium | 3 |
| Gamification (badges, streaks) | Medium | Low | 3 |
| Social Graph Intelligence | Very High | High | 4 |
| Narrative Mode (Year Wrapped, memory surfacing) | Very High | Medium | 4 |
| Privacy-First Export (reports, anonymized data) | Medium | Low–Medium | 4 |
| Language Intelligence (vocabulary, slang, code switching) | High | High | 5 |
| Emoji & Reaction Deep Intelligence | Medium | Medium | 5 |
| Cross-Platform Expansion (WhatsApp, Telegram, etc.) | Very High | High | 6 |
| AI-Assisted Insights (local LLM) | Very High | Very High | 6 |
| Relationship Compatibility (mutual import) | Medium | Medium | 7 |
| Personal Productivity Insights (sleep, dependency) | Medium | Medium | 7 |
| Experimental / Research-Grade (stylometry, roles) | Low–Medium | Very High | 7 |
| Radical / Moonshot Ideas | Low | Very High | 7 |

---

## Phase 1: Foundation (Near-Term)

### Media (Partially Done)

- ~~**Resolve media paths**~~ — Implemented: media extracted from ZIP to app storage
- ~~**Media display**~~ — Implemented: inline photos, videos, audio, files in message view
- **Media gallery** — Browse photos/videos per conversation or globally (not yet)

### Search Improvements

- **Full-text search (FTS5)** — Replace `LIKE` with SQLite FTS5 for faster, scalable search
- **Highlight matches** — Highlight search terms in message view
- **Search filters** — Limit by thread, date range, or sender

### UX Polish

- **Keyboard shortcuts** — Navigate threads, jump to date, focus search
- **Empty states** — Clearer guidance when no data is imported

### Data Management

- **Incremental import** — Re-import without full overwrite; merge new messages
- **Multi-export support** — Compare or combine exports from different dates
- ~~**Clear/reset data**~~ — Implemented: Clear all data on Import page

---

## Phase 2: Core Analytics

Foundation analytics layer — charts, counts, distributions.

### Time & Activity

- **Activity by time** — Messages per hour, day of week, month, year
- **Heatmaps** — Day-of-week × hour-of-day visualization
- **Timeline** — Most active chats/users per period
- **Response time** — Who replies quickly; patterns by time of day

### Language & Content

- **Word frequency** — Per chat, per user, with stopword filtering
- **Emoji stats** — Most used emojis by chat/user
- **Phrase analysis** — Common n-grams, signature phrases per chat
- **Word clouds** — Visual word distributions

### Media & Reactions

- **Media by type** — Distribution of photos, videos, voice memos, GIFs, stickers
- **Reaction analytics** — Frequency, who reacts to whom, trends over time
- **Most reacted messages** — Top messages by reaction count

### Charts & Dashboard

- **Chart library** — Integrate Recharts, Tremor, or Visx
- **Dashboard page** — Dedicated analytics view with multiple charts
- **Filters** — Select chats, date range, participants for analytics

---

## Phase 3: Behavioral & Emotional Intelligence

Move beyond counts. Model patterns and dynamics.

### Circadian Messaging Profile

- **Hour-by-hour activity heatmap** — Full 24h messaging rhythm
- **Weekday vs weekend behavior shift** — Compare activity patterns
- **Night owl index** — Quantify late-night messaging tendency
- **Seasonal variation** — Winter vs summer behavior differences
- **Per-conversation rhythms** — When do you message specific people?
- **Response delay distributions** — Histogram of response times

### Response Dynamics Model

- **Median reply time per person** — Who gets fast replies, who doesn't
- **Double-texting detection** — Who sends follow-up messages without a reply?
- **Conversation initiation ratio** — Who starts conversations?
- **Conversation ending patterns** — Who sends the last message?
- **Reply probability curves** — Predict likelihood of reply within 1h / 24h
- **Drift detection** — Are friendships cooling or warming over time?

### Conversation Entropy

Measure variability and predictability of conversations.

- **Topic entropy** — How varied are conversation subjects?
- **Message length entropy** — Consistent or wildly variable?
- **Emoji diversity index** — Broad palette or narrow favorites?
- Interpretation: high entropy = chaotic / expressive; low entropy = routine / structured

### Emotional Volatility Index

- **Emoji sentiment scoring** — Map emojis to emotional valence
- **Reaction polarity tracking** — Positive vs negative reaction patterns
- **Keyword-based mood scoring** — Simple lexicon-based sentiment
- **Mood cycles** — Track emotional patterns across years
- **Per-relationship emotional profiles** — Emotional tone per contact

### Gamification & Badges

- **Longest streak** — Consecutive days messaging a friend
- **Most active month ever** — Personal records
- **Quietest year / "Ghost mode" periods** — Inactivity detection
- **Badge system** — Night Owl, Emoji Addict, The Ghost, The Reactor, The Initiator

---

## Phase 4: Social Graph & Narrative

Turn conversations into a graph and tell stories with data.

### Relationship Strength Graph

Edges weighted by message frequency, response speed, message length, reaction frequency.

- **Core cluster** — Closest connections
- **Weak ties** — Infrequent but present contacts
- **Dormant connections** — Once-active, now silent

### Friendship Decay Model

- **Peak intensity detection** — Identify the peak friendship period
- **Gradual fading** — Slow decline in activity
- **Abrupt drop-offs** — Sudden communication stops
- Example output: *"Peak friendship year with Alex: 2019"*

### Social Circle Evolution

Cluster conversations by topic similarity, shared emoji usage, time-of-day activity.

- Visualize social phases: school era, work era, relationship era

### Cross-Conversation Insights

- **Relationship timelines** — Activity per person over time
- **Compare contexts** — 1:1 vs group chat language differences
- **Persona view** — How you write differently across chats

### Auto-Generated "Year Wrapped"

Go beyond stats — generate a narrative:

- Key activity peaks, most active friend, most emotional conversation
- Longest streak, quietest month
- **Exportable as PDF** — shareable story format

### Memory Surfacing Engine

Like Google Photos "On this day":

- This day N years ago
- Your most intense month ever
- Your longest argument / conversation

### Conversation Movie

Animated timeline playback:

- Message density animation over time
- Reaction burst visualization
- Spike and pattern highlighting

### Export & Sharing

- **Export to HTML** — Conversation or stats as a shareable HTML file
- **Export to PDF** — Printable conversation view
- **Anonymized recap** — Generate shareable "year in messages" with names redacted
- **Personal communication profile report** — Comprehensive self-analytics document
- **Anonymized research dataset** — For academic/research use
- **Personal archive snapshot** — Data portability

---

## Phase 5: Language & Emoji Intelligence

Where ChatWrapped can truly differentiate.

### Vocabulary Growth Tracking

- **Unique words per year** — Is your vocabulary expanding?
- **Average message length over time** — Becoming more concise or expressive?
- **Complexity drift** — Reading level / lexical diversity trends

### Slang Evolution

- **First usage detection** — When did you first use certain words/phrases?
- **Peak slang periods** — Temporal clusters of slang adoption
- **Phrase half-life** — How quickly do phrases fade from your vocabulary?
- Example output: *"Peak 'xd' usage: 2017"*

### Code Switching Detection

Detect shifts between:

- Formal / informal register
- Language A / Language B (multilingual users)
- Emoji-heavy vs text-heavy modes

### Emoji Personality Map

Cluster emojis into semantic categories (affection, sarcasm, celebration, conflict):

- **Emoji fingerprint** — Your unique emoji usage profile
- **Relationship emoji compatibility** — Compare emoji styles between contacts

### Reaction Reciprocity

- **Who reacts most / least?** — Reaction frequency rankings
- **Reaction symmetry score** — Is the reaction energy mutual?

### Contextual Emoji Usage

Map emoji use to:

- Time of day
- Specific contacts
- Emotional tone of conversation

---

## Phase 6: Platform Expansion & AI

### Cross-Platform Support

Messenger export is just one source. Unified schema enables cross-platform analytics.

- **WhatsApp exports**
- **Telegram exports**
- **Instagram DM exports**
- **Discord exports**
- **SMS backups**

Goal: *"Who do you talk to most across all platforms?"*

### AI-Assisted Insights (Local LLM)

Privacy-first, on-device inference:

- **Conversation summarization** — TL;DR for long threads
- **Topic clustering** — Auto-categorize conversations by theme
- **Recurring theme detection** — *"Most common theme with Anna: travel & work stress"*
- **Unresolved conflict detection** — Identify tension patterns
- **Support network identification** — Who do you turn to in hard times?

### Personal Language Model (Local Only)

Train a small local model on your messages:

- Your phrases, tone, emoji patterns
- **Linguistic fingerprint** — Unique writing style profile
- **Style comparison** — How your writing differs across contacts

---

## Phase 7: Experimental & Moonshot

High-ambition features for long-term exploration.

### Personal Productivity Insights

- **Sleep estimation** — Based on last/first message times
- **Sleep consistency tracking** — Weekend vs weekday shifts
- **Digital dependency score** — Conversation volume, response urgency, attachment dynamics

### Relationship Compatibility (Mutual Import)

If two users both import their exports:

- Message length symmetry
- Emoji similarity score
- Response timing compatibility
- Topic overlap analysis

### Linguistic Stylometry (Research-Grade)

- **Identity shift over years** — How has your writing voice changed?
- **Writing maturity tracking** — Complexity and structure evolution
- **Personality drift detection** — Behavioral markers over time

### Argument Detection

- **Conflict phase clustering** — Identify argument patterns
- **Cooldown time estimation** — How long until normal conversation resumes?

### Social Role Classification

Determine your communication role per relationship:

- Initiator, Supporter, Listener, Joker

### Radical Ideas

- **Communication Stock Market** — Friendship intensity chart like a stock price
- **Communication DNA** — Encode behavior into 10 metrics, generate a unique fingerprint
- **Mood Prediction Engine** — Predict next likely messaging spike

---

## Technical Debt & Improvements

- ~~**Error boundaries**~~ — Implemented: ErrorBoundary wraps app
- ~~**Loading states**~~ — Implemented: Skeleton loaders for threads, messages, stats
- **E2EE handling** — Document limitations; support `encrypted` folder fully
- **Format drift** — Robust parsing for future Meta export format changes
- **Performance** — Profile and optimize for very large exports (100k+ messages)
- **Dark mode toggle** — User preference for light/dark theme
- **Accessibility** — Screen reader support, high-contrast mode
- **Internationalization** — Multi-language UI

---

## Strategic Direction

### Avoid

- Just more charts and counts — raw numbers without interpretation

### Focus on

- **Derived insights** — Go beyond raw numbers to meaningful patterns
- **Behavioral modeling** — Understand communication dynamics, not just volume
- **Narrative** — Tell stories with data, not just display it
- **Time evolution** — Show how everything changes over years

### The unique angle

*"Understand how you communicate and how your relationships evolve over time."*

### The ultimate goal

**Personal Communication Intelligence Dashboard** — behavioral modeling, social graph analysis, linguistic identity, emotional trends, and relationship health signals. All local, all private.

---

## Reference

See [APP_OVERVIEW.md](./APP_OVERVIEW.md) for the full application overview, architecture, and data format documentation.
