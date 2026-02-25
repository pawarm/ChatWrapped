import * as fs from "fs";
import * as path from "path";
import archiver from "archiver";

// ─── Minimal valid media buffers ───────────────────────────────────────────────

const PNG_1x1 = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, // 8-bit RGB
  0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
  0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, // compressed pixel
  0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, // checksum
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, // IEND chunk
  0xae, 0x42, 0x60, 0x82,
]);

const GIF_1x1 = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
  0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, // 1x1, no GCT
  0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // image descriptor
  0x02, 0x02, 0x44, 0x01, 0x00, // LZW min code size + data
  0x3b, // trailer
]);

const JPEG_1x1 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
  0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
  0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
  0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
  0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
  0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
  0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
  0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
  0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
  0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
  0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
  0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
  0x00, 0x00, 0x3f, 0x00, 0x7b, 0x94, 0x11, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xd9,
]);

const MP4_PLACEHOLDER = Buffer.from([
  0x00, 0x00, 0x00, 0x18, // box size = 24
  0x66, 0x74, 0x79, 0x70, // 'ftyp'
  0x69, 0x73, 0x6f, 0x6d, // 'isom'
  0x00, 0x00, 0x02, 0x00, // minor version
  0x69, 0x73, 0x6f, 0x6d, // compatible brand 'isom'
  0x69, 0x73, 0x6f, 0x32, // compatible brand 'iso2'
]);

function mediaBuffer(type: "photo" | "video" | "gif" | "audio" | "sticker"): Buffer {
  switch (type) {
    case "photo": return Math.random() > 0.5 ? PNG_1x1 : JPEG_1x1;
    case "gif": return GIF_1x1;
    case "sticker": return PNG_1x1;
    case "video":
    case "audio": return MP4_PLACEHOLDER;
  }
}

function mediaExt(type: "photo" | "video" | "gif" | "audio" | "sticker"): string {
  switch (type) {
    case "photo": return ".jpg";
    case "gif": return ".gif";
    case "sticker": return ".png";
    case "video":
    case "audio": return ".mp4";
  }
}

// ─── Meta mojibake encoding ────────────────────────────────────────────────────

function metaEncode(text: string): string {
  const buf = Buffer.from(text, "utf-8");
  let result = "";
  for (const byte of buf) {
    if (byte < 0x80) {
      result += String.fromCharCode(byte);
    } else {
      result += String.fromCharCode(byte);
    }
  }
  return result;
}

// ─── Seeded PRNG (deterministic output) ────────────────────────────────────────

let _seed = 42;
function seededRandom(): number {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(seededRandom() * arr.length)];
}

function pickN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => seededRandom() - 0.5);
  return shuffled.slice(0, n);
}

function randInt(min: number, max: number): number {
  return Math.floor(seededRandom() * (max - min + 1)) + min;
}

// ─── Timestamp helpers ─────────────────────────────────────────────────────────

const JAN_2024 = new Date("2024-01-01T00:00:00Z").getTime();
const DEC_2024 = new Date("2024-12-31T23:59:59Z").getTime();

function ts(dateStr: string): number {
  return new Date(dateStr).getTime();
}

function randomTimeBetween(start: number, end: number): number {
  return start + Math.floor(seededRandom() * (end - start));
}

function distributeTimestamps(count: number, start: number, end: number): number[] {
  const timestamps: number[] = [];
  for (let i = 0; i < count; i++) {
    timestamps.push(randomTimeBetween(start, end));
  }
  return timestamps.sort((a, b) => a - b);
}

function midnightTimestamp(dateStr: string): number {
  return new Date(dateStr + "T00:00:00Z").getTime();
}

// ─── Message ID counter ────────────────────────────────────────────────────────

let _mediaIdCounter = 1000000000;
function nextMediaId(): string {
  return String(_mediaIdCounter++);
}

let _stickerIds = [
  "369239263222822",
  "369239343222814",
  "369239383222810",
  "227541690672600",
];

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MetaMessage {
  sender_name: string;
  timestamp_ms: number;
  content?: string;
  photos?: { uri: string; creation_timestamp: number }[];
  videos?: { uri: string; creation_timestamp: number }[];
  gifs?: { uri: string }[];
  audio_files?: { uri: string; creation_timestamp: number }[];
  files?: { uri: string; creation_timestamp: number }[];
  sticker?: { uri: string; ai_stickers: never[] };
  share?: { link: string; share_text?: string };
  reactions?: { reaction: string; actor: string }[];
  call_duration?: number;
  type?: string;
  is_geoblocked_for_viewer: boolean;
  is_unsent_image_by_messenger_kid_parent: boolean;
}

interface MediaFile {
  zipPath: string;
  buffer: Buffer;
}

interface ConversationDef {
  threadName: string;
  threadId: string;
  title: string;
  participants: string[];
  isGroup: boolean;
  isStillParticipant: boolean;
  location: "inbox" | "e2ee_cutover" | "archived_threads";
  messages: MetaMessage[];
  mediaFiles: MediaFile[];
  splitIntoFiles?: number;
}

// ─── Reaction sets ─────────────────────────────────────────────────────────────

const REACTION_EMOJIS = [
  "\u00f0\u009f\u0091\u008d",  // 👍
  "\u00e2\u009d\u00a4",        // ❤
  "\u00f0\u009f\u0098\u0086",  // 😆
  "\u00f0\u009f\u0098\u00ae",  // 😮
  "\u00f0\u009f\u0098\u00a2",  // 😢
  "\u00f0\u009f\u0098\u00a0",  // 😠
];

function makeReactions(actors: string[], count?: number): { reaction: string; actor: string }[] {
  const n = count ?? randInt(1, Math.min(3, actors.length));
  const chosen = pickN(actors, n);
  return chosen.map(actor => ({
    reaction: pick(REACTION_EMOJIS),
    actor: metaEncode(actor),
  }));
}

// ─── Message factories ─────────────────────────────────────────────────────────

function baseMsg(sender: string, timestampMs: number): MetaMessage {
  return {
    sender_name: metaEncode(sender),
    timestamp_ms: timestampMs,
    is_geoblocked_for_viewer: false,
    is_unsent_image_by_messenger_kid_parent: false,
  };
}

function textMsg(sender: string, timestampMs: number, content: string, reactions?: { reaction: string; actor: string }[]): MetaMessage {
  const msg = baseMsg(sender, timestampMs);
  msg.content = metaEncode(content);
  if (reactions) msg.reactions = reactions;
  return msg;
}

function photoMsg(
  sender: string,
  timestampMs: number,
  threadPath: string,
  mediaFiles: MediaFile[],
  count = 1,
  content?: string,
  reactions?: { reaction: string; actor: string }[]
): MetaMessage {
  const msg = baseMsg(sender, timestampMs);
  if (content) msg.content = metaEncode(content);
  if (reactions) msg.reactions = reactions;
  msg.photos = [];
  for (let i = 0; i < count; i++) {
    const id = nextMediaId();
    const ext = ".jpg";
    const uri = `your_facebook_activity/messages/${threadPath}/photos/${id}${ext}`;
    msg.photos.push({ uri, creation_timestamp: Math.floor(timestampMs / 1000) });
    mediaFiles.push({ zipPath: uri, buffer: JPEG_1x1 });
  }
  return msg;
}

function videoMsg(
  sender: string,
  timestampMs: number,
  threadPath: string,
  mediaFiles: MediaFile[],
  reactions?: { reaction: string; actor: string }[]
): MetaMessage {
  const msg = baseMsg(sender, timestampMs);
  if (reactions) msg.reactions = reactions;
  const id = nextMediaId();
  const uri = `your_facebook_activity/messages/${threadPath}/videos/${id}.mp4`;
  msg.videos = [{ uri, creation_timestamp: Math.floor(timestampMs / 1000) }];
  mediaFiles.push({ zipPath: uri, buffer: MP4_PLACEHOLDER });
  return msg;
}

function gifMsg(
  sender: string,
  timestampMs: number,
  threadPath: string,
  mediaFiles: MediaFile[],
  reactions?: { reaction: string; actor: string }[]
): MetaMessage {
  const msg = baseMsg(sender, timestampMs);
  if (reactions) msg.reactions = reactions;
  const id = nextMediaId();
  const uri = `your_facebook_activity/messages/${threadPath}/gifs/${id}.gif`;
  msg.gifs = [{ uri }];
  mediaFiles.push({ zipPath: uri, buffer: GIF_1x1 });
  return msg;
}

function audioMsg(
  sender: string,
  timestampMs: number,
  threadPath: string,
  mediaFiles: MediaFile[]
): MetaMessage {
  const msg = baseMsg(sender, timestampMs);
  const id = nextMediaId();
  const uri = `your_facebook_activity/messages/${threadPath}/audio/${id}.mp4`;
  msg.audio_files = [{ uri, creation_timestamp: Math.floor(timestampMs / 1000) }];
  mediaFiles.push({ zipPath: uri, buffer: MP4_PLACEHOLDER });
  return msg;
}

function stickerMsg(
  sender: string,
  timestampMs: number,
  stickerFiles: MediaFile[]
): MetaMessage {
  const msg = baseMsg(sender, timestampMs);
  const stickerId = pick(_stickerIds);
  const uri = `your_facebook_activity/messages/stickers_used/${stickerId}.png`;
  msg.sticker = { uri, ai_stickers: [] };
  if (!stickerFiles.some(f => f.zipPath === uri)) {
    stickerFiles.push({ zipPath: uri, buffer: PNG_1x1 });
  }
  return msg;
}

function shareMsg(
  sender: string,
  timestampMs: number,
  link: string,
  shareText?: string,
  reactions?: { reaction: string; actor: string }[]
): MetaMessage {
  const msg = baseMsg(sender, timestampMs);
  msg.content = link;
  msg.share = { link };
  msg.type = "Share";
  if (shareText) msg.share.share_text = shareText;
  if (reactions) msg.reactions = reactions;
  return msg;
}

function callMsg(
  sender: string,
  timestampMs: number,
  duration: number,
  ended = true
): MetaMessage {
  const msg = baseMsg(sender, timestampMs);
  msg.content = ended ? "The video call ended." : `${sender} started a video call.`;
  msg.call_duration = duration;
  return msg;
}

function groupEventMsg(
  sender: string,
  timestampMs: number,
  eventContent: string
): MetaMessage {
  const msg = baseMsg(sender, timestampMs);
  msg.content = metaEncode(eventContent);
  return msg;
}

function pollMsg(
  sender: string,
  timestampMs: number,
  content: string
): MetaMessage {
  const msg = baseMsg(sender, timestampMs);
  msg.content = metaEncode(content);
  return msg;
}

function liveLocationMsg(
  sender: string,
  timestampMs: number
): MetaMessage {
  const msg = baseMsg(sender, timestampMs);
  msg.content = metaEncode(`${sender} sent a live location.`);
  return msg;
}

function editedMsgPair(
  sender: string,
  timestampOriginal: number,
  originalContent: string,
  editedContent: string
): [MetaMessage, MetaMessage] {
  const original = textMsg(sender, timestampOriginal, originalContent);
  const edited = textMsg(sender, timestampOriginal + randInt(5000, 30000), editedContent + " (edited)");
  return [original, edited];
}

// ─── Conversation message content pools ────────────────────────────────────────

const FRIEND_TEXTS = [
  "yo what's up",
  "not much, just got home from work",
  "same, long day",
  "wanna grab food later?",
  "sure, where were you thinking?",
  "that new ramen place on 5th?",
  "oh yeah I heard it's really good",
  "let's do it, 7pm?",
  "perfect",
  "btw did you see the game last night?",
  "no I missed it, was it good?",
  "dude it was insane, overtime and everything",
  "ahh I always miss the good ones",
  "I'll send you the highlights",
  "thanks man",
  "np",
  "hey are you free this weekend?",
  "Saturday should work, why?",
  "thinking about hiking the ridge trail",
  "oh that's a solid plan, I'm in",
  "sweet, I'll pick you up at 8",
  "sounds good, I'll bring snacks",
  "bring those trail mix bars you had last time",
  "the ones with chocolate? done",
  "lol yes those were amazing",
  "haha alright see you then",
  "wait actually can we do 8:30 instead?",
  "yeah that's fine",
  "cool",
  "hey quick question",
  "shoot",
  "do you still have that camping stove?",
  "yeah it's in the garage somewhere",
  "can I borrow it next weekend?",
  "for sure, just remind me Friday",
  "will do, thanks",
  "no worries",
  "dude check this out",
  "lmaooo that's hilarious",
  "right? I died when I saw it",
  "forward that to the group chat",
  "already did haha",
  "ok so update on the ramen place",
  "yeah?",
  "it was SO good, you need to try it",
  "we should go again soon",
  "next week? same time?",
  "deal",
  "oh btw I got a new phone",
  "nice which one?",
  "the new pixel, camera is insane",
  "send me some pics when you test it",
  "I took some sunset shots earlier, sending now",
  "those are gorgeous",
  "thanks! the night mode is incredible too",
  "jealous honestly",
  "time to upgrade my friend",
  "maybe for Christmas lol",
  "haha fair enough",
  "hey you still awake?",
  "yeah what's up",
  "just wanted to say thanks for today, had a great time",
  "me too, we should do that more often",
  "for real, been too long since we just hung out",
  "agreed, let's make it a regular thing",
  "monthly at least",
  "deal",
  "alright I'm crashing, talk tomorrow",
  "night dude",
  "night!",
  "DUDE",
  "WHAT",
  "I got the job!!!",
  "NO WAY",
  "YES WAY",
  "CONGRATS!! That's huge!!",
  "thanks man I'm so hyped",
  "you deserve it, you worked so hard for this",
  "honestly couldn't have done the prep without your help",
  "oh stop, that was all you",
  "we need to celebrate",
  "absolutely, drinks on me this weekend",
  "you don't have to do that",
  "I want to, you earned it",
  "alright fine, but next round's on me",
  "deal haha",
  "ok I gotta tell my mom, she's gonna flip",
  "go go go, I'll text you later",
  "Thanks again seriously",
  "always 🙏",
];

const MOM_TEXTS = [
  "Hi sweetie, how was your day?",
  "Good thanks mom, busy but good",
  "Don't forget to eat properly!",
  "I am mom don't worry",
  "Did you take your vitamins?",
  "Yes mom 😊",
  "Ok just checking",
  "Love you",
  "Love you too mom ❤️",
  "I made that soup you like, wish I could send you some",
  "Aww that sounds so good right now",
  "Maybe next time you visit I'll make a big batch",
  "Yes please!",
  "How's work going?",
  "It's going well, learning a lot",
  "I'm so proud of you",
  "Thanks mom 🥰",
  "Can you call me when you get a chance?",
  "Sure, give me 20 minutes",
  "Ok no rush",
  "Hey mom, running late today",
  "Be careful driving!",
  "I will",
  "Text me when you get home safe",
  "Home! All good",
  "Good, sleep well sweetheart",
  "You too mom",
  "Morning! Beautiful day here",
  "Morning! Send me a picture of the garden",
  "The roses are blooming!",
  "Gorgeous!! Your garden is amazing",
  "Your father helped with the new bed",
  "Tell dad I said hi",
  "He says hi back and when are you visiting",
  "Hopefully next month!",
  "We'd love that",
  "I'll check flights this weekend",
  "Don't spend too much, we can pick you up from the bus station",
  "Ok I'll look at both options",
  "Just let us know the dates",
  "Will do!",
];

const HIKING_TEXTS = [
  "Hey everyone! Who's up for a hike this Saturday?",
  "I'm in! Where to?",
  "I was thinking Eagle Peak trail",
  "Oh nice, how long is that one?",
  "About 6 miles round trip, moderate difficulty",
  "Perfect, not too crazy",
  "I can drive if we need a ride",
  "That would be great, my car's in the shop",
  "Same, count me in for the ride",
  "Ok so I can fit 4 in my car, we're good",
  "What time are we meeting?",
  "How about 7am at the parking lot?",
  "7 is early but ok",
  "Gotta beat the crowds!",
  "True, last time it was packed by 9",
  "Everyone bring water and sunscreen",
  "And snacks!",
  "Obviously 😄",
  "I'll bring the trail mix",
  "I'll bring some sandwiches",
  "I can bring fruit",
  "Perfect, we're all set",
  "Weather looks good for Saturday, 72 and sunny",
  "Amazing, can't wait",
  "Same here, been stuck inside all week",
  "Me too, I need nature",
  "Don't forget hiking boots, the trail has some rocky sections",
  "Good call, thanks for the heads up",
  "Last time someone wore flip flops 💀",
  "That was ONE time ok",
  "haha never letting you forget that",
  "Alright alright",
  "Anyone want to do the extension loop? Adds another 2 miles",
  "I'm down if everyone else is",
  "Let's decide when we get there, see how we feel",
  "Smart, agreed",
  "Hey the trail might be muddy after yesterday's rain",
  "Good to know, I'll bring extra socks",
  "Pro move right there",
  "Ok I just checked and there's construction on the main road",
  "Take the back road through Millville instead",
  "Good looking out",
  "I'll share my location when I get close",
  "Same",
  "Ok final headcount: 5 of us going?",
  "Yep! Me, you, Sarah, Tom, and Lisa",
  "Great, see everyone bright and early!",
  "Can't wait!",
  "🏔️",
  "That view from the top was INCREDIBLE",
  "Best hike we've done honestly",
  "Agreed, the wildflowers were so pretty",
  "Uploading photos now",
  "Omg these are amazing",
  "The one at the summit 🔥",
  "Frame-worthy honestly",
  "Next hike when?",
  "Let's do Cedar Falls next time",
  "Ooh that one has a waterfall right?",
  "Yeah, supposedly gorgeous in spring",
  "I'm in!",
  "Same",
  "Let's plan for two weeks from now?",
  "Works for me",
  "Me too",
  "Alright, putting it in the calendar",
  "Hey quick update, the Cedar Falls parking lot requires a permit now",
  "Ugh seriously? How much?",
  "5 bucks per car, not bad",
  "Oh that's fine",
  "I'll grab one online",
  "Thanks!",
];

const WORK_TEXTS = [
  "Hi Sarah, quick question about the Q3 report",
  "Sure, what's up?",
  "Do you have the updated revenue figures?",
  "Yes, I'll send them over in a sec",
  "Thanks, the meeting is at 2",
  "Got it, I'll have everything ready",
  "The client wants to move the deadline up",
  "By how much?",
  "Two weeks",
  "That's tight but doable",
  "Yeah, we might need to pull in some extra help",
  "I can ask Jake if he's available",
  "Good idea, let me know",
  "Jake says he can help starting Thursday",
  "Perfect, I'll update the project plan",
  "Meeting notes are in the shared drive",
  "Thanks, I'll review them tonight",
  "No rush, but before tomorrow's standup",
  "Will do",
  "Hey, have you seen the new design mockups?",
  "Not yet, where are they?",
  "In Figma, I'll share the link",
  "Thanks, these look clean",
  "The client loved them too",
  "Nice, when's the next review?",
  "Friday at 3",
  "I'll block my calendar",
  "Oh and can you review the PR I submitted?",
  "Sure, I'll take a look this afternoon",
  "Thanks, it's the auth module refactor",
  "Good, been meaning to look at that",
];

const PARTNER_TEXTS = [
  "Good morning beautiful ❤️",
  "Morning! Sleep well?",
  "So well, dreamed about our trip",
  "Aww which one?",
  "The one to the coast, remember that sunset?",
  "Best sunset I've ever seen 🌅",
  "We need to go back",
  "Already looking at dates haha",
  "You're the best",
  "No YOU'RE the best",
  "Ok we're both the best",
  "Deal 😘",
  "What do you want for dinner tonight?",
  "Hmm, pasta?",
  "Ooh yes, I'll make that mushroom one you like",
  "With the garlic bread??",
  "Obviously",
  "I love you so much",
  "I love you more",
  "Not possible",
  "Very possible 💕",
  "ok fine we both love each other maximum",
  "accurate",
  "Just got out of work, heading home",
  "Drive safe! I'm already home, apartment smells amazing",
  "You're cooking?? I thought I was making dinner",
  "Surprise! Changed my mind, made that Thai curry",
  "omg WHAT",
  "And there's leftovers for tomorrow",
  "I'm marrying you",
  "That's the plan 💍",
  "hahaha ok be there in 20",
  "Can't wait 🥰",
  "Hey can you grab milk on the way home?",
  "Already got it plus those cookies you like",
  "You really are the best",
  "I know 😇",
  "Look at this apartment I found",
  "Oh that kitchen is gorgeous",
  "Right?? And it allows pets",
  "We could finally get a cat!",
  "Or two cats",
  "Let's not get ahead of ourselves",
  "Three cats",
  "RILEY",
  "ok fine two max",
  "That's what I thought 😂",
  "Can we talk about something?",
  "Of course, everything ok?",
  "Yeah everything is good, I just want to plan the holidays",
  "Oh ok! Yeah let's figure that out",
  "My parents invited us for Christmas Eve",
  "I'd love that, we can do your family Christmas Eve and mine Christmas Day?",
  "Perfect, that way nobody feels left out",
  "Exactly. I'll text my mom right now",
  "You're so good at this planning stuff",
  "Team effort 💪",
  "Miss you",
  "Miss you too, only a few more hours",
  "Counting down ⏰",
  "Same 💗",
];

const OLD_FRIEND_TEXTS_EARLY = [
  "CHRIS!! How are you man, feels like forever!",
  "Dude it HAS been forever! I'm good, you?",
  "Great, just moved to a new place",
  "No way, where to?",
  "Downtown, near the park",
  "Nice! We should hang out, catch up properly",
  "Absolutely, it's been way too long",
  "Remember that road trip we did senior year?",
  "How could I forget, your car broke down in the middle of nowhere",
  "And we had to sleep in that sketchy motel haha",
  "Best worst trip ever",
  "We need to do something like that again",
  "For sure, let me check my schedule",
  "Cool, no rush",
  "Hey are you going to Dave's thing next month?",
  "Maybe, I'll try to make it",
  "It would be great to see the old crew",
  "Yeah I miss everyone",
  "How's work treating you?",
  "Busy but good, just got promoted actually",
  "Congrats!! That's awesome",
  "Thanks! Lots more responsibility but I like it",
];

const OLD_FRIEND_TEXTS_LATE = [
  "Hey man, long time! How have you been?",
  "Hey! Good, busy with stuff. You?",
  "Same old same old haha. We should catch up sometime",
  "Yeah definitely, things are just crazy right now",
  "No worries, whenever you're free",
  "Hey happy birthday!",
  "Thanks man!",
];

const NEIGHBOR_TEXTS = [
  "Hi Pat, could you grab my package if it arrives today? I won't be home",
  "Sure thing, I'll keep an eye out",
  "Thanks so much, it should be a small box",
  "Got it! Left it by your door",
  "You're a lifesaver, thank you",
  "No problem at all",
  "Hey, did the power go out on your side too?",
  "Yeah about an hour ago, seems like the whole block",
  "Ok just wanted to make sure it wasn't just me",
  "They said it should be back by 6",
  "Good, thanks for checking",
  "Hey sorry to bother you, do you have a ladder I could borrow?",
  "Of course, it's in the shed, I'll unlock it",
  "Thanks Pat, I'll bring it back tomorrow",
  "No rush at all",
  "Hey just a heads up, I'm having a few people over Saturday, might be a bit noisy",
  "Thanks for letting me know! Have fun",
  "Will do, let me know if it's too loud",
  "I'm sure it'll be fine, enjoy!",
];

const COOKING_TEXTS = [
  "Dana you HAVE to try this recipe",
  "Ooh what is it?",
  "This amazing garlic butter chicken, so simple but so good",
  "Sending the link now",
  "That looks incredible! How long does it take?",
  "About 30 minutes total, it's a weeknight lifesaver",
  "Perfect, I'm adding it to my list",
  "Let me know how it turns out!",
  "I tried it last night, AMAZING",
  "Right?! The sauce is everything",
  "I added a bit of lemon, game changer",
  "Ooh smart, I'll try that next time",
  "Hey have you ever made sourdough?",
  "I tried once and it was a disaster 😂",
  "Same! The starter just died",
  "I watched like 10 YouTube videos and still couldn't get it right",
  "Maybe we should take a class",
  "That's actually a great idea",
  "There's one at the community center next month",
  "I'm signing up, let's do it together!",
  "Perfect!",
  "Look what I made!",
  "OMG that looks restaurant quality",
  "Thank you! It took forever but worth it",
  "Recipe??",
  "Let me write it up for you",
  "You're the best",
  "Just tried your mushroom risotto recipe",
  "And??",
  "Life changing. Seriously.",
  "haha I told you!",
  "My roommate wants the recipe too now",
];

const STUDY_TEXTS = [
  "Hey everyone, when's the next study session?",
  "I can do Thursday evening",
  "Works for me",
  "Same here",
  "Library or someone's place?",
  "Library has those group rooms we can book",
  "Good call, I'll reserve one",
  "Room booked, Thursday 6-9pm, room 204",
  "Perfect, thanks!",
  "Can someone share the lecture notes from Monday?",
  "I have them, uploading now",
  "Thank you!! I was sick and missed it",
  "No worries, get better soon!",
  "Ok so for the exam, chapters 5-8 right?",
  "Plus the supplementary readings",
  "Ugh that's a lot of material",
  "If we split it up it's manageable",
  "Good idea, I'll take chapters 5-6",
  "I'll do 7",
  "I've got 8 and the readings",
  "This is why study groups are the best",
  "Anyone understand the proof from lecture 12?",
  "Which one, the induction proof?",
  "Yeah, I'm completely lost on the base case",
  "Let me explain, so you start with n=1...",
  "OHHH ok that makes so much more sense now, thanks",
  "Happy to help!",
  "Ok I just finished my summary for chapter 7, 15 pages 💀",
  "FIFTEEN?",
  "The professor really packed that chapter",
  "Sending it to the group drive now",
  "You're a legend",
  "Exam is in 3 days, how's everyone feeling?",
  "Honestly pretty good, the study sessions really helped",
  "Cautiously optimistic",
  "I still need to review the last two topics",
  "We can go over those Thursday",
  "That would be great",
  "Good luck everyone! We've got this 💪",
];

const ROOMMATE_TEXTS = [
  "Who used the last of the milk and didn't replace it 😤",
  "Wasn't me, I bought oat milk",
  "...ok it was me sorry, I'll go to the store",
  "Thank you lol",
  "While you're there can you grab paper towels?",
  "Sure, anything else?",
  "Dish soap please",
  "Got it",
  "Rent's due tomorrow, everyone Venmo'd?",
  "Just sent mine",
  "Same",
  "Cool, we're good",
  "Hey the sink is clogged again",
  "Did you try the plunger?",
  "Yeah didn't work",
  "I'll text the landlord",
  "Thanks, it's getting nasty",
  "Plumber's coming Tuesday between 10-12",
  "Can anyone be here?",
  "I can, I work from home that day",
  "Perfect",
  "Ok who's doing the dishes tonight, it's been 3 days",
  "I did them last time!",
  "Fine I'll do them but someone else takes out trash",
  "Deal",
  "Movie night tonight?",
  "Yes!! What are we watching?",
  "I vote horror",
  "NO absolutely not, you know I can't sleep after those",
  "Fine, comedy?",
  "Comedy works, something new on Netflix?",
  "There's that one everyone's been talking about",
  "Perfect, 8pm?",
  "I'll make popcorn!",
  "I'll grab the blankets",
  "This is why we're the best roommates",
  "❤️❤️❤️",
  "GUYS GUYS GUYS",
  "what",
  "WHAT",
  "the hot water is BACK",
  "FINALLY",
  "I'm taking the longest shower of my life",
  "save some for the rest of us!!",
];

const GAMING_TEXTS = [
  "Anyone on tonight?",
  "I can be on in like 30",
  "Same",
  "Let's run it",
  "Bro that last game was INSANE",
  "My hands are shaking",
  "You clutched that so hard",
  "That 1v4 was legendary",
  "I'm clipping that",
  "Send it to me too",
  "already uploading lol",
  "GG boys",
  "GG",
  "one more?",
  "always one more",
  "ok last one for real this time",
  "you said that 3 games ago",
  "...ok fair",
  "NEW UPDATE DROPPED",
  "WHAT'S IN IT",
  "new map, new character, balance changes",
  "Is the OP character finally nerfed??",
  "Let me check the patch notes...",
  "YES THEY NERFED IT LETS GOOO",
  "FINALLY",
  "about time honestly",
  "downloading now",
  "me too, 20 minutes",
  "this new map is beautiful",
  "graphics go crazy",
  "anyone want to squad up for ranked?",
  "I'm down but I need to eat first",
  "15 min break?",
  "make it 20",
  "ok 20, then we grind",
  "to diamond!!",
  "to diamond!! 🏆",
  "BRO DID YOU SEE THAT",
  "NO SHOT",
  "THAT WAS THE BEST PLAY IVE EVER SEEN",
  "I need to go to bed",
  "just one more",
  "NO we said that at midnight it's now 3am",
  "......fine",
  "but tomorrow we run it back",
  "obviously",
  "night gamers",
  "night 🎮",
  "gg wp",
];

const BOOK_CLUB_TEXTS = [
  "Alright everyone, what did we think of this month's pick?",
  "I loved it, couldn't put it down",
  "Same, the twist at the end was incredible",
  "Really? I saw it coming from chapter 3",
  "No way, there's no way you predicted that",
  "The foreshadowing was pretty heavy-handed imo",
  "I think that's fair, but the prose was beautiful",
  "The prose carried the book honestly",
  "I cried at the ending",
  "Which part specifically?",
  "When she found the letter... I'm getting emotional just thinking about it",
  "That was definitely the most powerful scene",
  "The author's use of unreliable narration was masterful",
  "It reminded me a bit of Gone Girl in that way",
  "Ooh good comparison",
  "What did everyone think about the pacing?",
  "A bit slow in the middle",
  "Agreed, chapters 12-15 dragged",
  "But it picked up again beautifully",
  "The last 50 pages I read in one sitting",
  "Same!",
  "Rating out of 10?",
  "8",
  "8.5",
  "7, only because of the slow middle",
  "9, one of my favorites this year",
  "7.5",
  "7",
  "8",
  "Ok so rough average is about 7.9, not bad!",
  "What's next month's book?",
  "I was thinking something lighter after this one",
  "Yes please, I need a palate cleanser",
  "How about that new release everyone's talking about?",
  "Which one?",
  "The one about the bookshop owner who travels through time",
  "Oh I've heard great things about that one!",
  "Sounds fun, I'm in",
  "Same",
  "Perfect, so that's our pick for next month!",
  "Happy reading everyone 📚",
];

const REUNION_TEXTS = [
  "Hey everyone!! Long time no see! Who's joining the reunion?",
  "I'll be there!",
  "Count me in",
  "I'll try to make it, coming from out of state",
  "It would be SO good to see everyone",
  "Has it really been 10 years?",
  "Time flies, I feel old",
  "We ARE old 😂",
  "Speak for yourself!",
  "Remember Professor Thompson's class?",
  "How could I forget, hardest class of my life",
  "But we survived!",
  "Barely haha",
  "Who's organizing this thing?",
  "I can help with the venue",
  "I know a good restaurant with a private room",
  "That sounds perfect",
  "How many are we expecting?",
  "So far about 12 confirmed",
  "Nice! The more the merrier",
  "Can't wait to see what everyone's been up to",
  "Same, we need a proper catch-up",
];

const SELF_TEXTS = [
  "Remember to pick up dry cleaning",
  "Dentist appointment March 15 at 2pm",
  "Gift ideas: headphones, book, cooking class voucher",
  "Wifi password: SunflowerBridge42!",
  "Flight confirmation: AA1234 March 20 departing 6:45am",
  "todo: fix the kitchen light, call insurance, email landlord",
];

// ─── Very long message ─────────────────────────────────────────────────────────

const VERY_LONG_MESSAGE = `Ok so I've been thinking about this a lot and I need to get it all out. When we first started this project back in January I thought it would take maybe a month or two at most but here we are six months later and honestly I think we've built something really special. The initial prototype was rough and I remember we almost scrapped the whole thing after that first demo went sideways but we stuck with it and iterated and now look where we are. The user feedback has been overwhelmingly positive and I think that validates all the late nights and weekend sessions we put in. I know it hasn't been easy and there were moments where I wasn't sure we'd make it but the team really pulled together especially during that crunch in April when we had the server meltdown and had to rebuild the entire backend in like three days. That was honestly one of the most intense experiences of my professional life but also weirdly one of the most rewarding. I think what I'm trying to say is thank you to everyone who contributed to this. Whether you wrote code or designed interfaces or tested features or just provided moral support when things got tough it all mattered. Every single contribution pushed us closer to where we are today. And I think we're just getting started honestly. The roadmap for the next quarter is ambitious but if the last six months have taught me anything it's that this team can handle whatever comes our way. So let's celebrate this milestone but also let's keep pushing because I really believe we're building something that's going to make a real difference. Ok end of rant sorry for the novel 😂`;

// ─── Build conversations ───────────────────────────────────────────────────────

function buildSmallAlexJordan(): ConversationDef {
  const threadPath = "inbox/alexjordan_100001";
  const me = "Alex Chen";
  const friend = "Jordan Kim";
  const mediaFiles: MediaFile[] = [];
  const messages: MetaMessage[] = [];

  const times = distributeTimestamps(80, ts("2024-01-15T10:00:00Z"), ts("2024-12-20T22:00:00Z"));
  let ti = 0;

  for (let i = 0; i < FRIEND_TEXTS.length && ti < times.length; i++) {
    const sender = i % 2 === 0 ? me : friend;
    const t = times[ti++];
    const shouldReact = seededRandom() > 0.7;
    const reactions = shouldReact ? makeReactions([me, friend], 1) : undefined;
    messages.push(textMsg(sender, t, FRIEND_TEXTS[i], reactions));
  }

  const callTime = ts("2024-03-10T19:30:00Z");
  messages.push(callMsg(me, callTime, 0, false));
  messages.push(callMsg(me, callTime + 1845000, 1845));

  const linkTime = ts("2024-05-14T20:15:00Z");
  messages.push(shareMsg(me, linkTime, "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "you NEED to watch this"));
  messages.push(textMsg(friend, linkTime + 120000, "lol classic"));

  messages.push(photoMsg(friend, ts("2024-07-22T18:30:00Z"), threadPath, mediaFiles, 1, "sunset from my new phone!"));
  messages.push(photoMsg(me, ts("2024-07-22T18:35:00Z"), threadPath, mediaFiles, 2));

  const rapidBase = ts("2024-09-15T23:45:00Z");
  messages.push(textMsg(me, rapidBase, "DUDE"));
  messages.push(textMsg(me, rapidBase + 800, "ARE YOU AWAKE"));
  messages.push(textMsg(me, rapidBase + 1200, "CHECK YOUR EMAIL"));
  messages.push(textMsg(friend, rapidBase + 45000, "what what what"));

  const [origEdit, editedEdit] = editedMsgPair(me, ts("2024-06-01T14:00:00Z"),
    "meet me at the cafe at 3",
    "meet me at the cafe at 3:30");
  messages.push(origEdit, editedEdit);

  messages.push(textMsg(me, midnightTimestamp("2024-01-01"), "Happy new year!! 🎉"));
  messages.push(textMsg(friend, midnightTimestamp("2024-01-01") + 30000, "Happy new year!! 🥳🎆"));

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  return {
    threadName: "alexjordan",
    threadId: "100001",
    title: metaEncode(friend),
    participants: [friend, me],
    isGroup: false,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles,
  };
}

function buildSmallMom(): ConversationDef {
  const threadPath = "inbox/mariechen_100002";
  const me = "Alex Chen";
  const mom = "Marie Chen";
  const mediaFiles: MediaFile[] = [];
  const stickerFiles: MediaFile[] = [];
  const messages: MetaMessage[] = [];

  const times = distributeTimestamps(30, ts("2024-01-10T08:00:00Z"), ts("2024-12-25T20:00:00Z"));
  let ti = 0;

  for (let i = 0; i < MOM_TEXTS.length && ti < times.length; i++) {
    const sender = i % 2 === 0 ? mom : me;
    messages.push(textMsg(sender, times[ti++], MOM_TEXTS[i]));
  }

  messages.push(stickerMsg(me, ts("2024-02-14T09:00:00Z"), stickerFiles));
  messages.push(stickerMsg(mom, ts("2024-05-12T10:30:00Z"), stickerFiles));

  messages.push(audioMsg(mom, ts("2024-03-20T18:00:00Z"), threadPath, mediaFiles));
  messages.push(audioMsg(mom, ts("2024-08-05T19:15:00Z"), threadPath, mediaFiles));

  messages.push(photoMsg(mom, ts("2024-04-15T11:00:00Z"), threadPath, mediaFiles, 1, "The roses are blooming!"));
  messages.push(photoMsg(mom, ts("2024-06-20T16:30:00Z"), threadPath, mediaFiles, 3));

  messages.push(callMsg(mom, ts("2024-07-01T20:00:00Z"), 0, false));
  messages.push(callMsg(mom, ts("2024-07-01T20:00:30Z"), 0));

  messages.push(callMsg(mom, ts("2024-09-10T19:00:00Z"), 0, false));
  messages.push(callMsg(mom, ts("2024-09-10T19:00:00Z") + 900000, 900));

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
  mediaFiles.push(...stickerFiles);

  return {
    threadName: "mariechen",
    threadId: "100002",
    title: metaEncode(mom),
    participants: [mom, me],
    isGroup: false,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles,
  };
}

function buildSmallHikers(): ConversationDef {
  const threadPath = "inbox/weekendhikers_100003";
  const me = "Alex Chen";
  const members = ["Sarah Park", "Tom Rivera", "Lisa Nguyen", "Mike O'Brien"];
  const all = [me, ...members];
  const mediaFiles: MediaFile[] = [];
  const stickerFiles: MediaFile[] = [];
  const messages: MetaMessage[] = [];

  const times = distributeTimestamps(60, ts("2024-02-01T09:00:00Z"), ts("2024-11-30T20:00:00Z"));
  let ti = 0;

  for (let i = 0; i < HIKING_TEXTS.length && ti < times.length; i++) {
    const sender = pick(all);
    const shouldReact = seededRandom() > 0.6;
    const reactions = shouldReact ? makeReactions(all.filter(p => p !== sender), randInt(1, 3)) : undefined;
    messages.push(textMsg(sender, times[ti++], HIKING_TEXTS[i], reactions));
  }

  messages.push(groupEventMsg(me, ts("2024-02-01T08:00:00Z"), `${me} named the group Weekend Hikers`));
  messages.push(groupEventMsg(me, ts("2024-02-01T08:05:00Z"), `${me} added Sarah Park to the group.`));
  messages.push(groupEventMsg(me, ts("2024-02-01T08:05:30Z"), `${me} added Tom Rivera to the group.`));
  messages.push(groupEventMsg(me, ts("2024-02-01T08:06:00Z"), `${me} added Lisa Nguyen to the group.`));
  messages.push(groupEventMsg(me, ts("2024-02-01T08:06:30Z"), `${me} added Mike O'Brien to the group.`));

  messages.push(pollMsg(me, ts("2024-03-10T18:00:00Z"), `${me} created a poll: When should we hike next?`));
  messages.push(pollMsg(members[0], ts("2024-03-10T18:30:00Z"), `${members[0]} voted for Saturday in the poll.`));
  messages.push(pollMsg(members[1], ts("2024-03-10T19:00:00Z"), `${members[1]} voted for Sunday in the poll.`));
  messages.push(pollMsg(members[2], ts("2024-03-10T19:15:00Z"), `${members[2]} voted for Saturday in the poll.`));

  messages.push(liveLocationMsg(members[0], ts("2024-04-13T07:30:00Z")));

  messages.push(photoMsg(members[1], ts("2024-04-13T12:00:00Z"), threadPath, mediaFiles, 3, undefined,
    makeReactions(all.filter(p => p !== members[1]), 3)));
  messages.push(photoMsg(me, ts("2024-04-13T12:15:00Z"), threadPath, mediaFiles, 2));
  messages.push(photoMsg(members[2], ts("2024-06-22T13:00:00Z"), threadPath, mediaFiles, 1));

  messages.push(gifMsg(members[3], ts("2024-05-05T20:00:00Z"), threadPath, mediaFiles,
    makeReactions(all.filter(p => p !== members[3]), 2)));

  messages.push(videoMsg(members[1], ts("2024-08-10T14:30:00Z"), threadPath, mediaFiles));

  messages.push(shareMsg(members[0], ts("2024-07-15T09:00:00Z"),
    "https://www.alltrails.com/trail/us/cedar-falls-loop",
    "Cedar Falls Loop - check this one out!"));

  messages.push(stickerMsg(members[2], ts("2024-09-20T21:00:00Z"), stickerFiles));

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
  mediaFiles.push(...stickerFiles);

  return {
    threadName: "weekendhikers",
    threadId: "100003",
    title: "Weekend Hikers",
    participants: all,
    isGroup: true,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles,
  };
}

// ─── Large dataset conversations ───────────────────────────────────────────────

function buildLargeAlexJordan(): ConversationDef {
  const small = buildSmallAlexJordan();
  const threadPath = `inbox/${small.threadName}_${small.threadId}`;
  const me = "Alex Chen";
  const friend = "Jordan Kim";
  const mediaFiles = [...small.mediaFiles];
  const messages = [...small.messages];

  const extraTimes = distributeTimestamps(320, ts("2024-01-01T06:00:00Z"), ts("2024-12-31T23:59:00Z"));
  const extraTexts = [
    ...FRIEND_TEXTS,
    "bro I just found the BEST coffee shop",
    "where??",
    "that corner spot on Maple, the one that was being renovated",
    "ohh I walked past that the other day! Is it open?",
    "yeah and their cold brew is incredible",
    "going tomorrow",
    "worth it trust me",
    "remember when we tried to make cold brew at home?",
    "the kitchen smelled like coffee for a WEEK",
    "your roommate was so mad 😂",
    "she still brings it up sometimes haha",
    "ok but it tasted amazing",
    "it really did though",
    "we should try again with better equipment",
    "I saw a kit on Amazon for like 30 bucks",
    "link?",
    "sending now",
    "ordered",
    "that was fast",
    "I'm an impulse buyer what can I say",
    "remember that time we got lost in the subway?",
    "dude we ended up in Brooklyn somehow",
    "and found that incredible pizza place",
    "best accident ever",
    "we should go back there",
    "do you remember the name?",
    "something Italian... Lorenzo's maybe?",
    "I'll look through my photos",
    "found it! Luigi's on 4th",
    "THAT'S IT",
    "their pepperoni was life changing",
    "ok planning a trip back, you in?",
    "absolutely, name the date",
    "this weekend?",
    "let's do it",
    "ok what about the movies this Friday?",
    "what's playing?",
    "that new sci-fi thing everyone's talking about",
    "oh the one with the time loops? I'm so down",
    "7pm showing work?",
    "perfect, I'll get tickets",
    "you're the best",
    "I know 😎",
    "hey real talk for a sec",
    "yeah what's up",
    "just wanted to say I really appreciate our friendship",
    "out of nowhere but I love it, same dude",
    "you're genuinely one of my closest friends",
    "stop you're gonna make me cry",
    "haha ok back to memes",
    "there it is 😂",
    "how's your sister doing btw?",
    "she's great! just started med school",
    "that's amazing, she was always the smartest one",
    "don't let her hear you say that, her ego's big enough",
    "haha runs in the family then",
    "HEY",
    "😇",
    "anyway she says hi",
    "tell her hi back and good luck with school!",
    "will do",
    "oh hey I've been meaning to ask",
    "yeah?",
    "are you still doing that 5k training?",
    "yeah! Race is in 3 weeks",
    "I want to come cheer you on",
    "seriously? That would mean a lot",
    "of course, what are friends for",
    "sending you the details",
    "I'll be there with a big embarrassing sign",
    "wouldn't expect anything less 😂",
    "you think I'm joking",
    "oh no I know you're dead serious",
    "glitter, neon, the whole thing",
    "I both love and fear you",
    "as you should",
  ];

  for (let i = 0; i < extraTimes.length; i++) {
    const sender = i % 2 === 0 ? me : friend;
    const text = extraTexts[i % extraTexts.length];
    const shouldReact = seededRandom() > 0.75;
    const reactions = shouldReact ? makeReactions([me, friend], 1) : undefined;
    messages.push(textMsg(sender, extraTimes[i], text, reactions));
  }

  messages.push(photoMsg(me, ts("2024-02-14T15:00:00Z"), threadPath, mediaFiles, 1, "Valentine's day roses for myself 😂"));
  messages.push(photoMsg(friend, ts("2024-04-01T12:00:00Z"), threadPath, mediaFiles, 2));
  messages.push(gifMsg(friend, ts("2024-06-15T22:00:00Z"), threadPath, mediaFiles));
  messages.push(gifMsg(me, ts("2024-10-31T20:00:00Z"), threadPath, mediaFiles));
  messages.push(videoMsg(me, ts("2024-08-20T17:00:00Z"), threadPath, mediaFiles));

  messages.push(shareMsg(friend, ts("2024-03-25T11:00:00Z"),
    "https://en.wikipedia.org/wiki/Dunning%E2%80%93Kruger_effect", "this explains so much"));
  messages.push(shareMsg(me, ts("2024-11-15T09:00:00Z"),
    "https://github.com/cool-project/releases/tag/v2.0", "my side project just hit v2!"));

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
  return { ...small, messages, mediaFiles };
}

function buildLargeMom(): ConversationDef {
  const small = buildSmallMom();
  const threadPath = `inbox/${small.threadName}_${small.threadId}`;
  const me = "Alex Chen";
  const mom = "Marie Chen";
  const mediaFiles = [...small.mediaFiles];
  const messages = [...small.messages];

  const extraTimes = distributeTimestamps(160, ts("2024-01-01T07:00:00Z"), ts("2024-12-31T21:00:00Z"));
  const extraTexts = [
    ...MOM_TEXTS,
    "Are you wearing a jacket? It's cold today",
    "Yes mom I have a jacket",
    "A warm one?",
    "THE warmest one",
    "Good",
    "How's your friend Jordan?",
    "He's great, we went hiking last weekend",
    "Be careful on those trails!",
    "We are mom, always prepared",
    "Send me photos next time!",
    "I will!",
    "I found your baby photos while cleaning",
    "Oh no 😱",
    "You were SO cute, look at these cheeks!",
    "Mom please don't show those to anyone",
    "Too late, sent to the family group 🤣",
    "MOOOM",
    "What? You were adorable",
    "emphasis on WERE",
    "You still are sweetie 💕",
    "ok fine thank you",
    "Have you been eating enough vegetables?",
    "Define enough",
    "At least 3 servings a day",
    "...I'll work on it",
    "I'm sending you some recipes",
    "Ok thanks mom",
    "Don't just say ok and ignore them!",
    "I won't! I promise!",
    "I'll hold you to that",
    "I know you will 😂",
  ];

  for (let i = 0; i < extraTimes.length; i++) {
    const sender = i % 2 === 0 ? mom : me;
    messages.push(textMsg(sender, extraTimes[i], extraTexts[i % extraTexts.length]));
  }

  messages.push(photoMsg(mom, ts("2024-10-15T10:00:00Z"), threadPath, mediaFiles, 2));
  messages.push(audioMsg(mom, ts("2024-11-20T18:30:00Z"), threadPath, mediaFiles));
  messages.push(audioMsg(mom, ts("2024-06-14T09:00:00Z"), threadPath, mediaFiles));

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
  return { ...small, messages, mediaFiles };
}

function buildWorkSarah(): ConversationDef {
  const threadPath = "inbox/sarahwork_100004";
  const me = "Alex Chen";
  const sarah = "Sarah Mitchell";
  const mediaFiles: MediaFile[] = [];
  const messages: MetaMessage[] = [];

  const times = distributeTimestamps(150, ts("2024-01-08T09:00:00Z"), ts("2024-12-20T17:00:00Z"));
  const allTexts = [...WORK_TEXTS,
    "Can you review the staging deployment?",
    "Done, looks good to me",
    "Great, pushing to prod",
    "Client call went well, they approved the designs",
    "Awesome! One less thing to worry about",
    "Sprint retro at 4, don't forget",
    "Already blocked off, see you there",
    "Updated the Jira tickets, we're on track",
    "Nice, under budget too",
    "Always love to hear that",
    "Quarterly review is next week, need your slides by Friday",
    "I'll have them Thursday",
    "Perfect",
    "Hey want to grab lunch?",
    "Sure, cafeteria or outside?",
    "Outside, it's too nice to eat inside",
    "Agreed, meet at 12:15?",
    "See you then",
    "The new intern is really sharp",
    "Yeah she picked up the codebase fast",
    "Good hire",
  ];

  for (let i = 0; i < times.length; i++) {
    const sender = i % 2 === 0 ? me : sarah;
    messages.push(textMsg(sender, times[i], allTexts[i % allTexts.length]));
  }

  messages.push(shareMsg(sarah, ts("2024-02-20T10:00:00Z"),
    "https://docs.google.com/spreadsheets/d/abc123/edit", "Q3 revenue numbers"));
  messages.push(shareMsg(me, ts("2024-04-10T14:00:00Z"),
    "https://www.figma.com/file/xyz789", "Updated mockups"));
  messages.push(shareMsg(sarah, ts("2024-06-15T11:30:00Z"),
    "https://www.notion.so/meeting-notes-456", "Meeting notes from today"));

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  return {
    threadName: "sarahwork",
    threadId: "100004",
    title: metaEncode(sarah),
    participants: [sarah, me],
    isGroup: false,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles,
  };
}

function buildOldFriendChris(): ConversationDef {
  const me = "Alex Chen";
  const chris = "Chris Davidson";
  const mediaFiles: MediaFile[] = [];
  const messages: MetaMessage[] = [];

  const earlyTimes = distributeTimestamps(70, ts("2024-01-05T10:00:00Z"), ts("2024-04-30T20:00:00Z"));
  for (let i = 0; i < earlyTimes.length; i++) {
    const sender = i % 2 === 0 ? me : chris;
    messages.push(textMsg(sender, earlyTimes[i], OLD_FRIEND_TEXTS_EARLY[i % OLD_FRIEND_TEXTS_EARLY.length]));
  }

  const midTimes = distributeTimestamps(20, ts("2024-05-01T10:00:00Z"), ts("2024-08-31T20:00:00Z"));
  const midTexts = ["hey!", "hey what's up", "not much, you?", "busy with work stuff", "same, let's catch up soon",
    "yeah for sure", "how was the weekend?", "pretty chill, you?", "went to a concert", "nice which one?"];
  for (let i = 0; i < midTimes.length; i++) {
    const sender = i % 2 === 0 ? me : chris;
    messages.push(textMsg(sender, midTimes[i], midTexts[i % midTexts.length]));
  }

  const lateTimes = distributeTimestamps(10, ts("2024-09-01T10:00:00Z"), ts("2024-12-31T20:00:00Z"));
  for (let i = 0; i < lateTimes.length; i++) {
    const sender = i % 2 === 0 ? me : chris;
    messages.push(textMsg(sender, lateTimes[i], OLD_FRIEND_TEXTS_LATE[i % OLD_FRIEND_TEXTS_LATE.length]));
  }

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  return {
    threadName: "chrisdavidson",
    threadId: "100005",
    title: metaEncode(chris),
    participants: [chris, me],
    isGroup: false,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles,
  };
}

function buildPartnerRiley(): ConversationDef {
  const threadPath = "inbox/rileyjohnson_100006";
  const me = "Alex Chen";
  const riley = "Riley Johnson";
  const mediaFiles: MediaFile[] = [];
  const stickerFiles: MediaFile[] = [];
  const messages: MetaMessage[] = [];

  const times = distributeTimestamps(500, ts("2024-01-01T06:00:00Z"), ts("2024-12-31T23:59:00Z"));
  const allTexts = [...PARTNER_TEXTS,
    "I made us reservations for Friday",
    "where??",
    "that Italian place you've been wanting to try",
    "NO WAY you're the absolute best",
    "I know 😏",
    "ok but seriously thank you, I've been wanting to go for months",
    "anything for you ❤️",
    "Stop being so perfect",
    "never",
    "ugh fine 💕",
    "How was your meeting?",
    "Long but productive, we got the green light",
    "That's amazing!! So proud of you",
    "Thanks love, couldn't do it without your pep talks",
    "That's literally what I'm here for",
    "That and making amazing curry",
    "multitalented 💅",
    "you really are though",
    "I found the cutest dog at the shelter today",
    "DON'T",
    "Look at this face",
    "we said we'd wait until we move",
    "but LOOK AT IT",
    "I'm not looking",
    "You're looking aren't you",
    "...maybe",
    "SEE",
    "ok it IS really cute",
    "so...?",
    "we'll DISCUSS it",
    "that's basically a yes",
    "it is NOT basically a yes",
    "narrator: it was basically a yes",
    "I love you but I also hate you sometimes",
    "you love me all the time and you know it",
    "...yeah ok fine",
    "😘😘😘",
    "Good night love",
    "Night, sweet dreams ✨",
    "Dream about me",
    "Always do 💫",
    "ok that was smooth",
    "I learned from the best",
    "you mean me?",
    "obviously 😊",
  ];

  for (let i = 0; i < times.length; i++) {
    const sender = i % 2 === 0 ? me : riley;
    const shouldReact = seededRandom() > 0.5;
    const reactions = shouldReact ? makeReactions([me, riley], 1) : undefined;
    messages.push(textMsg(sender, times[i], allTexts[i % allTexts.length], reactions));
  }

  for (let month = 1; month <= 12; month++) {
    const d = `2024-${String(month).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`;
    messages.push(photoMsg(pick([me, riley]), ts(`${d}T${randInt(10, 20)}:00:00Z`),
      threadPath, mediaFiles, randInt(1, 3)));
  }

  messages.push(stickerMsg(riley, ts("2024-02-14T08:00:00Z"), stickerFiles));
  messages.push(stickerMsg(me, ts("2024-02-14T08:05:00Z"), stickerFiles));
  messages.push(gifMsg(riley, ts("2024-04-01T12:00:00Z"), threadPath, mediaFiles));
  messages.push(gifMsg(me, ts("2024-10-31T23:59:00Z"), threadPath, mediaFiles));
  messages.push(videoMsg(riley, ts("2024-07-04T21:00:00Z"), threadPath, mediaFiles,
    makeReactions([me], 1)));
  messages.push(audioMsg(riley, ts("2024-12-25T07:00:00Z"), threadPath, mediaFiles));

  messages.push(callMsg(me, ts("2024-01-20T22:00:00Z"), 0, false));
  messages.push(callMsg(me, ts("2024-01-20T22:00:00Z") + 3600000, 3600));
  messages.push(callMsg(riley, ts("2024-06-15T20:00:00Z"), 0, false));
  messages.push(callMsg(riley, ts("2024-06-15T20:00:00Z") + 2400000, 2400));

  messages.push(textMsg(me, ts("2024-12-25T00:00:00Z"), "Merry Christmas my love ❤️🎄",
    makeReactions([riley], 1)));
  messages.push(textMsg(riley, ts("2024-12-25T00:00:30Z"), "Merry Christmas!! Best gift is you 🎁💕"));

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
  mediaFiles.push(...stickerFiles);

  return {
    threadName: "rileyjohnson",
    threadId: "100006",
    title: metaEncode(riley),
    participants: [riley, me],
    isGroup: false,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles,
  };
}

function buildNeighborPat(): ConversationDef {
  const me = "Alex Chen";
  const pat = "Pat Morrison";
  const messages: MetaMessage[] = [];

  const times = distributeTimestamps(20, ts("2024-02-01T09:00:00Z"), ts("2024-12-15T18:00:00Z"));
  for (let i = 0; i < times.length && i < NEIGHBOR_TEXTS.length; i++) {
    const sender = i % 2 === 0 ? me : pat;
    messages.push(textMsg(sender, times[i], NEIGHBOR_TEXTS[i]));
  }

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  return {
    threadName: "patmorrison",
    threadId: "100007",
    title: metaEncode(pat),
    participants: [pat, me],
    isGroup: false,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles: [],
  };
}

function buildCookingDana(): ConversationDef {
  const threadPath = "inbox/danawilliams_100008";
  const me = "Alex Chen";
  const dana = "Dana Williams";
  const mediaFiles: MediaFile[] = [];
  const messages: MetaMessage[] = [];

  const times = distributeTimestamps(80, ts("2024-01-20T10:00:00Z"), ts("2024-12-10T20:00:00Z"));
  for (let i = 0; i < times.length; i++) {
    const sender = i % 2 === 0 ? me : dana;
    const shouldReact = seededRandom() > 0.7;
    const reactions = shouldReact ? makeReactions([me, dana], 1) : undefined;
    messages.push(textMsg(sender, times[i], COOKING_TEXTS[i % COOKING_TEXTS.length], reactions));
  }

  messages.push(shareMsg(me, ts("2024-03-01T19:00:00Z"),
    "https://www.bonappetit.com/recipe/garlic-butter-chicken", "The garlic butter chicken recipe!"));
  messages.push(shareMsg(dana, ts("2024-05-10T12:00:00Z"),
    "https://www.youtube.com/watch?v=sourdough123", "sourdough tutorial that actually works"));
  messages.push(shareMsg(me, ts("2024-09-25T18:00:00Z"),
    "https://cooking.nytimes.com/recipes/mushroom-risotto", "the risotto recipe finally"));

  messages.push(photoMsg(me, ts("2024-04-05T19:30:00Z"), threadPath, mediaFiles, 1, "Look what I made!"));
  messages.push(photoMsg(dana, ts("2024-06-18T20:00:00Z"), threadPath, mediaFiles, 2,
    undefined, makeReactions([me], 1)));
  messages.push(photoMsg(me, ts("2024-08-22T19:00:00Z"), threadPath, mediaFiles, 1));
  messages.push(photoMsg(dana, ts("2024-11-28T18:00:00Z"), threadPath, mediaFiles, 3,
    "Thanksgiving feast!"));

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  return {
    threadName: "danawilliams",
    threadId: "100008",
    title: metaEncode(dana),
    participants: [dana, me],
    isGroup: false,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles,
  };
}

function buildLargeHikers(): ConversationDef {
  const small = buildSmallHikers();
  const threadPath = `inbox/${small.threadName}_${small.threadId}`;
  const me = "Alex Chen";
  const all = small.participants;
  const mediaFiles = [...small.mediaFiles];
  const messages = [...small.messages];

  const extraTimes = distributeTimestamps(180, ts("2024-01-01T07:00:00Z"), ts("2024-12-31T21:00:00Z"));
  const extraTexts = [...HIKING_TEXTS,
    "Guys I found a new trail app",
    "Which one?",
    "AllTrails premium is on sale",
    "Worth it?",
    "100%, the offline maps alone are game changing",
    "Downloading now",
    "Brought my dog today, hope that's ok",
    "Of course! More the merrier",
    "She loved the trail",
    "Who wants to try overnight camping?",
    "Like backpacking?",
    "Yeah! 2 day trip",
    "I have a tent that fits 3",
    "I have a solo tent",
    "So we're covered",
    "When?",
    "Memorial Day weekend?",
    "PERFECT",
    "I'll research campsites",
    "Bear canister required apparently",
    "I have one",
    "You just have everything don't you",
    "Prepared is my middle name",
    "haha sure it is",
  ];

  for (let i = 0; i < extraTimes.length; i++) {
    const sender = pick(all);
    const shouldReact = seededRandom() > 0.65;
    const reactions = shouldReact ? makeReactions(all.filter(p => p !== sender), randInt(1, 4)) : undefined;
    messages.push(textMsg(sender, extraTimes[i], extraTexts[i % extraTexts.length], reactions));
  }

  messages.push(groupEventMsg(me, ts("2024-06-01T10:00:00Z"), `${me} named the group Weekend Hikers 🏔️`));
  messages.push(photoMsg(pick(all), ts("2024-05-25T15:00:00Z"), threadPath, mediaFiles, 4));
  messages.push(photoMsg(pick(all), ts("2024-09-15T11:00:00Z"), threadPath, mediaFiles, 2));
  messages.push(videoMsg(pick(all), ts("2024-07-04T16:00:00Z"), threadPath, mediaFiles));
  messages.push(liveLocationMsg(pick(all), ts("2024-08-03T08:00:00Z")));
  messages.push(liveLocationMsg(pick(all), ts("2024-10-12T07:30:00Z")));

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
  return { ...small, messages, mediaFiles };
}

function buildStudyGroup(): ConversationDef {
  const threadPath = "inbox/studygroup_100009";
  const me = "Alex Chen";
  const members = ["Emma Lee", "David Patel", "Sofia García", "James Wright", "Olivia Brown"];
  const all = [me, ...members];
  const mediaFiles: MediaFile[] = [];
  const messages: MetaMessage[] = [];

  const examPeriods = [
    [ts("2024-02-20T09:00:00Z"), ts("2024-03-10T22:00:00Z")],
    [ts("2024-05-15T09:00:00Z"), ts("2024-06-05T22:00:00Z")],
    [ts("2024-10-01T09:00:00Z"), ts("2024-10-20T22:00:00Z")],
    [ts("2024-12-01T09:00:00Z"), ts("2024-12-18T22:00:00Z")],
  ];

  for (const [start, end] of examPeriods) {
    const burstTimes = distributeTimestamps(50, start, end);
    const texts = [...STUDY_TEXTS,
      "I'm losing my mind with this material",
      "Same, but we'll get through it",
      "Coffee is my best friend right now",
      "Who needs sleep anyway",
      "Practice problems are posted",
      "Thanks! Starting them now",
      "Anyone got the answer to Q7?",
      "I got 42, but I'm not sure about the method",
      "Yeah I got the same thing",
      "Let's go over it together tomorrow",
    ];
    for (let i = 0; i < burstTimes.length; i++) {
      const sender = pick(all);
      messages.push(textMsg(sender, burstTimes[i], texts[i % texts.length]));
    }
  }

  messages.push(textMsg(pick(members), ts("2024-06-05T15:00:00Z"), VERY_LONG_MESSAGE));

  messages.push(shareMsg(pick(members), ts("2024-02-25T14:00:00Z"),
    "https://drive.google.com/file/d/lecture-notes", "Lecture notes from Monday"));
  messages.push(shareMsg(pick(members), ts("2024-05-20T16:00:00Z"),
    "https://drive.google.com/file/d/practice-exam", "Practice exam from last year"));

  messages.push(groupEventMsg(me, ts("2024-01-15T10:00:00Z"), `${me} named the group Study Group 📚`));
  for (const m of members) {
    messages.push(groupEventMsg(me, ts("2024-01-15T10:01:00Z") + members.indexOf(m) * 10000, `${me} added ${m} to the group.`));
  }

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  return {
    threadName: "studygroup",
    threadId: "100009",
    title: metaEncode("Study Group 📚"),
    participants: all,
    isGroup: true,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles,
  };
}

function buildRoommates(): ConversationDef {
  const threadPath = "inbox/roommates_100010";
  const me = "Alex Chen";
  const members = ["Casey Taylor", "Morgan Lee"];
  const all = [me, ...members];
  const mediaFiles: MediaFile[] = [];
  const messages: MetaMessage[] = [];

  const times = distributeTimestamps(150, ts("2024-01-01T07:00:00Z"), ts("2024-12-31T23:00:00Z"));
  const allTexts = [...ROOMMATE_TEXTS,
    "Did anyone check the mail?",
    "Nothing today",
    "Expecting something?",
    "My new headphones should be here by Friday",
    "Nice",
    "Wifi is being weird again",
    "Try resetting the router",
    "Did that, still slow",
    "I'll call the provider tomorrow",
    "Hey can I use your blender?",
    "Go for it, it's clean",
    "Thanks!",
    "Making smoothies?",
    "Attempting to, wish me luck",
    "Don't destroy my blender please",
    "No promises",
  ];

  for (let i = 0; i < times.length; i++) {
    const sender = pick(all);
    const shouldReact = seededRandom() > 0.5;
    const reactions = shouldReact ? makeReactions(all.filter(p => p !== sender), randInt(1, 2)) : undefined;
    messages.push(textMsg(sender, times[i], allTexts[i % allTexts.length], reactions));
  }

  const rapidBase2 = ts("2024-03-15T22:30:00Z");
  messages.push(textMsg(members[0], rapidBase2, "GUYS"));
  messages.push(textMsg(members[0], rapidBase2 + 500, "THERE IS A SPIDER"));
  messages.push(textMsg(members[0], rapidBase2 + 800, "IN THE BATHROOM"));
  messages.push(textMsg(members[0], rapidBase2 + 1100, "ITS HUGE"));
  messages.push(textMsg(me, rapidBase2 + 15000, "omw"));
  messages.push(textMsg(members[1], rapidBase2 + 16000, "I'm hiding in my room"));

  messages.push(groupEventMsg(me, ts("2024-01-01T12:00:00Z"), `${me} named the group Roommates 🏠`));

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  return {
    threadName: "roommates",
    threadId: "100010",
    title: metaEncode("Roommates 🏠"),
    participants: all,
    isGroup: true,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles,
  };
}

function buildGamingSquad(): ConversationDef {
  const threadPath = "inbox/gamingsquad_100011";
  const me = "Alex Chen";
  const members = ["Jake Stone", "Leo Nakamura", "Aiden Cruz", "Nate Fischer"];
  const all = [me, ...members];
  const mediaFiles: MediaFile[] = [];
  const messages: MetaMessage[] = [];

  const times = distributeTimestamps(200, ts("2024-01-01T18:00:00Z"), ts("2024-12-31T03:00:00Z"));
  const allTexts = [...GAMING_TEXTS,
    "new season dropping Tuesday",
    "LETS GOOO",
    "battle pass worth it?",
    "the skins are fire this time",
    "I'm buying it",
    "same, day one",
    "who's streaming tonight?",
    "I can stream if someone brings the content",
    "I AM the content",
    "ok mr. humble over here",
    "haha",
    "server's down",
    "AGAIN?",
    "yeah maintenance apparently",
    "for how long?",
    "2 hours they said",
    "guess I'll touch grass",
    "wild concept",
    "ikr",
    "ok I'm back, servers up?",
    "yep let's go",
    "lobbying up",
    "invite me",
    "sent",
    "got it, loading in",
    "THIS GAME",
    "I literally had him",
    "you definitely did not have him",
    "rewatch the clip",
    "I watched it, you missed every shot",
    "lag",
    "always lag 😂",
    "ok but actually though my ping was like 200",
    "that's rough",
    "switch servers maybe?",
    "trying now",
    "much better, 30ms",
    "let's get these dubs",
  ];

  for (let i = 0; i < times.length; i++) {
    const sender = pick(all);
    const shouldReact = seededRandom() > 0.4;
    const reactions = shouldReact ? makeReactions(all.filter(p => p !== sender), randInt(1, 3)) : undefined;
    messages.push(textMsg(sender, times[i], allTexts[i % allTexts.length], reactions));
  }

  for (let i = 0; i < 8; i++) {
    messages.push(gifMsg(pick(all), randomTimeBetween(ts("2024-01-01T00:00:00Z"), ts("2024-12-31T23:59:00Z")),
      threadPath, mediaFiles));
  }

  messages.push(videoMsg(pick(all), ts("2024-06-20T23:30:00Z"), threadPath, mediaFiles,
    makeReactions(all, 4)));
  messages.push(videoMsg(pick(all), ts("2024-11-05T01:00:00Z"), threadPath, mediaFiles));

  messages.push(shareMsg(pick(all), ts("2024-03-15T20:00:00Z"),
    "https://www.youtube.com/watch?v=epic-clutch-play", "THE CLIP"));
  messages.push(shareMsg(pick(all), ts("2024-08-22T19:00:00Z"),
    "https://twitter.com/game_updates/status/12345", "new update looks insane"));

  messages.push(groupEventMsg(me, ts("2024-01-01T00:00:00Z"), `${me} named the group Gaming Squad 🎮`));

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  return {
    threadName: "gamingsquad",
    threadId: "100011",
    title: metaEncode("Gaming Squad 🎮"),
    participants: all,
    isGroup: true,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles,
  };
}

function buildBookClub(): ConversationDef {
  const me = "Alex Chen";
  const members = ["Rachel Adams", "Ben Torres", "Mia Chen", "Noah Hart", "Zoe Kim", "Liam Byrne", "Ava Patel"];
  const all = [me, ...members];
  const messages: MetaMessage[] = [];

  const monthlyBursts = [
    ts("2024-01-28T19:00:00Z"), ts("2024-02-25T19:00:00Z"),
    ts("2024-03-31T19:00:00Z"), ts("2024-04-28T19:00:00Z"),
    ts("2024-05-26T19:00:00Z"), ts("2024-06-30T19:00:00Z"),
    ts("2024-07-28T19:00:00Z"), ts("2024-08-25T19:00:00Z"),
    ts("2024-09-29T19:00:00Z"), ts("2024-10-27T19:00:00Z"),
  ];

  for (const burstStart of monthlyBursts) {
    const burstTimes = distributeTimestamps(10, burstStart, burstStart + 2 * 3600000);
    for (let i = 0; i < burstTimes.length; i++) {
      const sender = pick(all);
      const text = BOOK_CLUB_TEXTS[i % BOOK_CLUB_TEXTS.length];
      messages.push(textMsg(sender, burstTimes[i], text));
    }
  }

  messages.push(groupEventMsg(me, ts("2024-01-05T12:00:00Z"), `${me} named the group Book Club 📖`));
  for (const m of members) {
    messages.push(groupEventMsg(me, ts("2024-01-05T12:00:30Z") + members.indexOf(m) * 5000,
      `${me} added ${m} to the group.`));
  }

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  return {
    threadName: "bookclub",
    threadId: "100012",
    title: metaEncode("Book Club 📖"),
    participants: all,
    isGroup: true,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles: [],
  };
}

function buildCollegeReunion(): ConversationDef {
  const me = "Alex Chen";
  const members = [
    "Dave Wilson", "Amy Brooks", "Tyler Ross", "Jessica Ng",
    "Brandon Lee", "Samantha Diaz", "Kevin Park", "Natalie Moore",
    "Eric Chang", "Hannah Foster", "Derek Liu", "Facebook User",
    "Melissa Grant", "Ryan O'Connor",
  ];
  const all = [me, ...members];
  const messages: MetaMessage[] = [];

  const times = distributeTimestamps(40, ts("2024-06-01T10:00:00Z"), ts("2024-12-31T20:00:00Z"));
  for (let i = 0; i < times.length; i++) {
    const sender = pick(all);
    messages.push(textMsg(sender, times[i], REUNION_TEXTS[i % REUNION_TEXTS.length]));
  }

  messages.push(groupEventMsg(members[0], ts("2024-05-20T15:00:00Z"),
    `${members[0]} named the group Class of 2014 Reunion`));
  for (let i = 0; i < 8; i++) {
    messages.push(groupEventMsg(members[0], ts("2024-05-20T15:01:00Z") + i * 5000,
      `${members[0]} added ${members[i + 1] ?? me} to the group.`));
  }
  messages.push(groupEventMsg(me, ts("2024-05-21T10:00:00Z"),
    `${me} added ${members[8]} to the group.`));
  messages.push(groupEventMsg(me, ts("2024-05-21T10:00:30Z"),
    `${me} added ${members[9]} to the group.`));

  messages.push(groupEventMsg(members[11], ts("2024-08-15T14:00:00Z"),
    `${members[11]} left the group.`));
  messages.push(groupEventMsg(members[0], ts("2024-09-01T10:00:00Z"),
    `${members[0]} removed ${members[10]} from the group.`));

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  return {
    threadName: "classof2014reunion",
    threadId: "100013",
    title: "Class of 2014 Reunion",
    participants: all,
    isGroup: true,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles: [],
  };
}

function buildSelfChat(): ConversationDef {
  const me = "Alex Chen";
  const messages: MetaMessage[] = [];

  const times = distributeTimestamps(6, ts("2024-01-15T09:00:00Z"), ts("2024-11-20T18:00:00Z"));
  for (let i = 0; i < SELF_TEXTS.length && i < times.length; i++) {
    messages.push(textMsg(me, times[i], SELF_TEXTS[i]));
  }

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  return {
    threadName: "alexchen",
    threadId: "100014",
    title: metaEncode(me),
    participants: [me],
    isGroup: false,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles: [],
  };
}

function buildE2eeConversation(): ConversationDef {
  const me = "Alex Chen";
  const other = "Sam Kowalski";
  const messages: MetaMessage[] = [];

  const times = distributeTimestamps(25, ts("2024-03-01T10:00:00Z"), ts("2024-12-15T20:00:00Z"));
  const texts = [
    "Hey, testing the new encrypted chat",
    "Oh cool, so everything is E2EE now?",
    "Yeah, Meta switched it on by default",
    "Nice, about time honestly",
    "Right? Should've been there from the start",
    "So what are you up to this weekend?",
    "Probably just relaxing, you?",
    "Same, maybe cook something nice",
    "Send me recipes if you find anything good",
    "Will do!",
    "Hey did you see the news?",
    "Which news?",
    "About the tech conference next month",
    "Oh yeah! Are you going?",
    "Thinking about it, tickets are pricey though",
    "Split a hotel room?",
    "That could work actually",
    "Let's look into it",
    "Sent you some hotel options",
    "Nice, option 2 looks great",
    "Agreed, booking it",
    "Done!",
    "This is going to be fun",
    "Can't wait!",
    "See you there 🎉",
  ];

  for (let i = 0; i < times.length; i++) {
    const sender = i % 2 === 0 ? me : other;
    messages.push(textMsg(sender, times[i], texts[i]));
  }

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  return {
    threadName: "samkowalski",
    threadId: "100015",
    title: metaEncode(other),
    participants: [other, me],
    isGroup: false,
    isStillParticipant: true,
    location: "e2ee_cutover",
    messages,
    mediaFiles: [],
  };
}

function buildArchivedConversation(): ConversationDef {
  const me = "Alex Chen";
  const other = "Taylor Swift Fan Club Admin";
  const messages: MetaMessage[] = [];

  const times = distributeTimestamps(8, ts("2024-01-01T10:00:00Z"), ts("2024-03-15T15:00:00Z"));
  const texts = [
    "Hi! Welcome to the fan club group purchases.",
    "Hey, I'd like to order 2 tickets for the March show",
    "Sure! That'll be $150 each. Payment through the usual link.",
    "Done, just sent it",
    "Got it, thanks! Your tickets will be at will-call.",
    "Perfect, thank you!",
    "Enjoy the show!",
    "It was AMAZING, thank you so much!",
  ];

  for (let i = 0; i < times.length; i++) {
    const sender = i % 2 === 0 ? other : me;
    messages.push(textMsg(sender, times[i], texts[i]));
  }

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  return {
    threadName: "taylorswiftfanclubadmin",
    threadId: "100016",
    title: metaEncode(other),
    participants: [other, me],
    isGroup: false,
    isStillParticipant: false,
    location: "archived_threads",
    messages,
    mediaFiles: [],
  };
}

function buildDeletedAccountConversation(): ConversationDef {
  const me = "Alex Chen";
  const messages: MetaMessage[] = [];

  messages.push(textMsg("Facebook User", ts("2024-02-10T14:00:00Z"), "Hey, long time!"));
  messages.push(textMsg(me, ts("2024-02-10T14:05:00Z"), "Who is this?"));
  messages.push(textMsg("Facebook User", ts("2024-02-10T14:06:00Z"), "It's me! We met at the conference"));
  messages.push(textMsg(me, ts("2024-02-10T14:10:00Z"), "Oh right! How are you?"));
  messages.push(textMsg("Facebook User", ts("2024-02-10T14:12:00Z"), "Good good, just wanted to reconnect"));

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  return {
    threadName: "facebookuser",
    threadId: "100017",
    title: "Facebook User",
    participants: [{ name: "" } as unknown as string, me],
    isGroup: false,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles: [],
  };
}

// ─── Conversation with mojibake names (testing encoding) ───────────────────────

function buildMojibakeConversation(): ConversationDef {
  const me = "Alex Chen";
  const friend = "José María López";
  const mediaFiles: MediaFile[] = [];
  const messages: MetaMessage[] = [];

  const times = distributeTimestamps(15, ts("2024-04-01T10:00:00Z"), ts("2024-10-30T20:00:00Z"));
  const texts = [
    "¡Hola! ¿Cómo estás?",
    "Hey! I'm good, learning some español",
    "¡Muy bien! Te puedo ayudar 😊",
    "That would be awesome!",
    "Práctica: ¿Dónde está la biblioteca?",
    "Umm... the library is over there? 😂",
    "Close enough haha, ¡buen intento!",
    "Gracias 🙏",
    "De nada, amigo",
    "Hey check out this café I found",
    "The croissants look amazing! 🥐",
    "Très magnifique",
    "Now you're mixing languages 😄",
    "Polyglot vibes ✨",
    "Jajaja me encanta",
  ];

  for (let i = 0; i < times.length; i++) {
    const sender = i % 2 === 0 ? friend : me;
    const shouldReact = seededRandom() > 0.6;
    const reactions = shouldReact ? makeReactions([me, friend], 1) : undefined;
    messages.push(textMsg(sender, times[i], texts[i], reactions));
  }

  messages.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

  return {
    threadName: "josemarialopez",
    threadId: "100018",
    title: metaEncode(friend),
    participants: [friend, me],
    isGroup: false,
    isStillParticipant: true,
    location: "inbox",
    messages,
    mediaFiles,
  };
}

// ─── ZIP builder ───────────────────────────────────────────────────────────────

function conversationToJson(conv: ConversationDef, messagesSlice: MetaMessage[]): object {
  const threadPath = `${conv.location}/${conv.threadName}_${conv.threadId}`;

  const participantNames = conv.participants.map(p => {
    if (typeof p === "string") return { name: metaEncode(p) };
    return p;
  });

  const obj: Record<string, unknown> = {
    participants: participantNames,
    messages: messagesSlice,
    title: conv.title,
    is_still_participant: conv.isStillParticipant,
    thread_path: threadPath,
    magic_words: [],
  };

  if (conv.isGroup) {
    obj.joinable_mode = { mode: 1, link: "" };
  }

  return obj;
}

function splitMessages(messages: MetaMessage[], numFiles: number): MetaMessage[][] {
  if (numFiles <= 1) return [messages];
  const chunkSize = Math.ceil(messages.length / numFiles);
  const chunks: MetaMessage[][] = [];
  for (let i = 0; i < messages.length; i += chunkSize) {
    chunks.push(messages.slice(i, i + chunkSize));
  }
  return chunks;
}

async function buildZip(conversations: ConversationDef[], outputPath: string): Promise<void> {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 5 } });

    output.on("close", () => {
      console.log(`  Created ${outputPath} (${(archive.pointer() / 1024).toFixed(1)} KB)`);
      resolve();
    });
    archive.on("error", reject);
    archive.pipe(output);

    const addedMedia = new Set<string>();

    for (const conv of conversations) {
      const threadDir = `your_facebook_activity/messages/${conv.location}/${conv.threadName}_${conv.threadId}`;
      const numFiles = conv.splitIntoFiles ?? 1;
      const messageChunks = splitMessages(conv.messages, numFiles);

      for (let i = 0; i < messageChunks.length; i++) {
        const json = conversationToJson(conv, messageChunks[i]);
        const jsonStr = JSON.stringify(json, null, 2);
        archive.append(jsonStr, { name: `${threadDir}/message_${i + 1}.json` });
      }

      for (const mf of conv.mediaFiles) {
        if (!addedMedia.has(mf.zipPath)) {
          archive.append(mf.buffer, { name: mf.zipPath });
          addedMedia.add(mf.zipPath);
        }
      }
    }

    archive.finalize();
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Generating test data...\n");

  _seed = 42;

  const smallAlex = buildSmallAlexJordan();
  const smallMom = buildSmallMom();
  const smallHikers = buildSmallHikers();

  console.log("Small dataset:");
  console.log(`  ${smallAlex.threadName}: ${smallAlex.messages.length} messages, ${smallAlex.mediaFiles.length} media`);
  console.log(`  ${smallMom.threadName}: ${smallMom.messages.length} messages, ${smallMom.mediaFiles.length} media`);
  console.log(`  ${smallHikers.threadName}: ${smallHikers.messages.length} messages, ${smallHikers.mediaFiles.length} media`);

  await buildZip([smallAlex, smallMom, smallHikers], "test-data/test-data-small.zip");

  _seed = 42;

  const largeAlex = buildLargeAlexJordan();
  const largeMom = buildLargeMom();
  const workSarah = buildWorkSarah();
  const oldChris = buildOldFriendChris();
  const partnerRiley = buildPartnerRiley();
  const neighborPat = buildNeighborPat();
  const cookingDana = buildCookingDana();
  const largeHikers = buildLargeHikers();
  const studyGroup = buildStudyGroup();
  const roommates = buildRoommates();
  const gamingSquad = buildGamingSquad();
  const bookClub = buildBookClub();
  const reunion = buildCollegeReunion();
  const selfChat = buildSelfChat();
  const e2eeChat = buildE2eeConversation();
  const archivedChat = buildArchivedConversation();
  const deletedAcct = buildDeletedAccountConversation();
  const mojibakeChat = buildMojibakeConversation();

  studyGroup.splitIntoFiles = 2;

  const largeConvs = [
    largeAlex, largeMom, workSarah, oldChris, partnerRiley, neighborPat, cookingDana,
    largeHikers, studyGroup, roommates, gamingSquad, bookClub, reunion,
    selfChat, e2eeChat, archivedChat, deletedAcct, mojibakeChat,
  ];

  console.log("\nLarge dataset:");
  let totalMessages = 0;
  let totalMedia = 0;
  for (const c of largeConvs) {
    console.log(`  ${c.threadName}: ${c.messages.length} messages, ${c.mediaFiles.length} media [${c.location}]`);
    totalMessages += c.messages.length;
    totalMedia += c.mediaFiles.length;
  }
  console.log(`  TOTAL: ${totalMessages} messages, ${totalMedia} media files, ${largeConvs.length} conversations`);

  await buildZip(largeConvs, "test-data/test-data-large.zip");

  console.log("\nDone!");
}

main().catch(console.error);
