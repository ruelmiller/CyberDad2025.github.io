"""
CyberDadKit Daily Post Generator — v3
- Pulls family-relevant CISA threat alerts (with multi-feed fallback)
- Translates into parent-friendly post via OpenAI (varied voice, real citations)
- Adds author byline, last-reviewed date, schema-friendly front matter
- Generates Pinterest-optimized branded image (1000x1500)
- Triple duplicate-prevention (daily limit + log + filesystem)
"""

import os
import re
import json
import random
import hashlib
import textwrap
import datetime
from pathlib import Path

import feedparser
from openai import OpenAI
from PIL import Image, ImageDraw, ImageFont

# -------- CONFIG --------
SITE_URL = "https://cyberdad2025.github.io"
POSTS_DIR = Path("_posts")
LOG_FILE = Path("logs/posted.json")
IMAGES_DIR = Path("assets/pins")

# Author config — owner-approved claims only (claims-audit-2026-10-20.md). No employers, no current-SOC wording, no "expert".
AUTHOR_NAME = "Ruel Miller"
AUTHOR_TITLE = "U.S. Marine Corps veteran, CompTIA Security+ · Founder, CyberDadKit"
AUTHOR_EMAIL = "ruel@getcyberdadkit.com"
AUTHOR_SLUG = "ruel-miller"
AUTHOR_BIO = (
    "Ruel Miller is a U.S. Marine Corps veteran and CompTIA Security+ certified dad "
    "with hands-on Security Operations Center experience, who built CyberDadKit "
    "to help families protect themselves online."
)

# CISA has shifted feeds before. Try multiple in order so the script doesn't
# fail when one URL gets retired.
CISA_FEEDS = [
    "https://www.cisa.gov/cybersecurity-advisories/all.xml",
    "https://www.cisa.gov/news.xml",
    "https://www.cisa.gov/uscert/ncas/alerts.xml",
]

FAMILY_KEYWORDS = [
    "phishing", "scam", "malware", "password", "social media",
    "children", "gaming", "roblox", "tiktok", "router", "wifi",
    "identity theft", "spyware", "parental", "family", "home",
    "mobile", "iphone", "android", "breach", "data leak",
    "ransomware", "smishing", "fraud", "snapchat", "discord",
    "chrome", "youtube", "instagram", "minecraft", "fortnite",
]

# -------- R9: UNVERIFIED-STATS GUARD --------
# No sourced numbers exist for these claims, so a post that contains one is never written.
# Kept in step with the R9 rules in netlify/functions/generate-blog.js (CLAIMS_RULES).
# The P5 claims guard absorbs these rules (CLAIMS_RULES = [...] + UNVERIFIED_STATS_RULES).
UNVERIFIED_STATS_RULES = [
    ("unverified stat: N% of families/parents", re.compile(
        r"\b\d{1,3}(?:\.\d+)?\s?%\s+of\s+(?:all\s+)?(?:families|parents|households|kids|children|teens|users|people|Americans)\b", re.I)),
    ("unverified stat: attacks increased N%", re.compile(
        r"\b(?:cyber[- ]?)?(?:attacks?|threats?|incidents?|scams?|breaches|crimes?)\b[^.!?\n]{0,80}?\b(?:increased|increase|risen|rose|grown|grew|surged|jumped|spiked|up)\s+(?:by\s+)?(?:over\s+|more than\s+)?\d+(?:\.\d+)?\s?%"
        r"|\b(?:increased|risen|grown|surged|jumped)\s+(?:by\s+)?\d+(?:\.\d+)?\s?%\s+(?:this|last|in the past|over the past|per)\s+year", re.I)),
    ("unverified stat: trusted by a crowd (millions/thousands)", re.compile(
        r"\btrusted by (?:millions|thousands|hundreds|tens of thousands|over\s+\d|more than\s+\d|\d)", re.I)),
    # R9d (CoS 2026-10-21): uncited 'N in M teens/kids/children/parents/families' ratios.
    # Allowed only when the same line links its source (URL, markdown link, <a href> or 'Source:').
    ("unverified stat: N in M teens/kids/parents", re.compile(
        r"^(?![^\n]*(?:https?://|\]\(|<a\s[^>]*href=|\bsources?:))[^\n]*?\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:in|out of)\s+(?:every\s+)?(?:[2-9]|\d{2,}|two|three|four|five|six|seven|eight|nine|ten)\s+(?:[a-z.]+\s+)?(?:teens?|teenagers?|tweens?|kids?|children|child|youths?|parents?|families|family|households?)\b", re.I | re.M)),
    # R9f (CoS + Product 2026-10-21): age-range badges ('ages 4-99', 'All ages (8-99)') are not backed by kit v3.4;
    # reading time must not be a hardcoded number.
    ("unverified age-range badge: ages N-99", re.compile(
        r"\bages?\s*\(?\d{1,2}\s*(?:-|–|to)\s*99\b", re.I)),
    ("hardcoded reading time: Takes N minutes to read", re.compile(
        r"\btakes?\s+\d+\s*(?:-\s*\d+\s*)?(?:minutes?|mins?)\s+to\s+read\b", re.I)),
    # R9g (CoS 2026-10-21): uncited research/study attribution ('according to a (recent) study', 'studies + show',
    # 'research + suggests', 'experts + say'); allowed only when the same line links its source
    # (URL, markdown link, <a href> or 'Source:'). Plus 'Real' + 'Statistics' headings.
    ("uncited research/study attribution", re.compile(
        r"^(?![^\n]*(?:https?://|\]\(|<a\s[^>]*href=|\bsources?:))[^\n]*?\b(?:according to (?:a |an |the )?(?:recent |new |latest |\d{4} )?(?:cybersecurity |cyber |security |safety |online safety |industry |internet |crime )?(?:study|studies|survey|surveys|report|reports|research|statistics|stats|data|experts?)|(?:stud(?:y|ies)|surveys?|research|reports?|statistics|data) (?:shows?|suggests?|has shown|have shown|found|finds|indicates?|reveals?|revealed|confirms?)|experts? (?:say|says|agree|agrees|warn|warns|estimate|estimates|believe)|in a recent (?:study|survey|report))\b", re.I | re.M)),
    ('"Real Statistics" heading', re.compile(
        r"\breal statistics\b|\bstatistics and (?:current )?trends\b", re.I)),
    # R9h (CoS + Product 2026-10-21): no time or benefit promises in posts
    # (setup time 'less than N min', 'N min or less', multi-year protection).
    ("time promise: less than N minutes", re.compile(
        r"\bless than \d+\s*(?:minutes?|mins?)\b", re.I)),
    ("time promise: N Minutes or Less", re.compile(
        r"\b\d+\s*(?:minutes?|mins?)\s+or\s+less\b", re.I)),
    ('benefit promise: "years of ... protection"', re.compile(
        r"\byears of (?:family )?protection\b", re.I)),
    # R9i (CoS 2026-10-21): uncited minute promises in a title or heading (front matter title/seo_title/og_title,
    # markdown headings, <h1>-<h6>). Covers in/under/within/takes/only/just + N minutes, and hyphenated N-minute + fix/setup/check/guide/...;
    # a source link on the line exempts it. Kit phrase allowed: 'one 15-minute Quick Action'.
    # main() also checks the post title on its own line (TITLE_LINE_PREFIX), since it is not in the body.
    ("time promise in title/heading: in N minutes", re.compile(
        r"^(?![^\n]*(?:https?://|\]\(|<a\s[^>]*href=|\bsources?:))(?:[ \t]*(?:seo_title|og_title|title)[ \t]*:|[ \t]*#{1,6}[ \t]|[^\n]*<h[1-6]\b[^>]*>)[^\n]*?(?:\b(?:in|under|within|takes?|taking|only|just)[ \t]+(?:about[ \t]+|around[ \t]+|less[ \t]+than[ \t]+)?(?:\d+|one|two|three|four|five|ten|fifteen|twenty|thirty|sixty)[ \t]*-?[ \t]*(?:minutes?|mins?)\b|\b(?!(?<=\bone )15-minute Quick Action\b)(?:\d+|one|two|three|four|five|ten|fifteen|twenty|thirty|sixty)[ \t]*-[ \t]*minutes?[ \t]+(?:[\w'-]+[ \t]+){0,2}?(?:fix|fixes|setup|set-up|check|checks|checkup|check-up|guide|plan|audit|lockdown|makeover|routine|task|tasks|action|actions|tune-up|upgrade|challenge|habit|habits|tip|tips|win|wins|reset|review|walkthrough|tutorial|security|protection|lesson)\b)", re.I | re.M)),
    # R9n (CoS + Product M-D7, 2026-10-21): every minute phrase is a time promise, except the kit lines Product allows
    # ('one 15-minute Quick Action' / 'Each module starts with a 15-minute Quick Action') and a computed 'N min read'.
    # A source link does not exempt it. CoS 10:21 ruling: the 'Wait 10 minutes, then check your Spam/Junk folder' allowance is removed.
    # R9 (F, CoS 2026-10-21): also 'a minute' and 'in/within seconds' ('few minutes', 'in minutes' already covered).
    ("time promise: N minutes (outside the allowed kit lines)", re.compile(
        r"^(?![^\n]*15-minute Quick Action)[^\n]*?(?:\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty-five|sixty|a few|few|several|a couple of|a)[ \t]*-?[ \t]*(?:minutes?|mins?)\b(?![ \t]+read\b)|\b(?:within|in)[ \t]+(?:minutes|seconds)\b)", re.I | re.M)),
    # R9n: 'tonight' / 'instant' / 'instantly' wording (Product rule: 0 on the site).
    ("'tonight'/'instant' wording", re.compile(
        r"\b(?:tonight|instant|instantly)\b", re.I)),
    # R9n: unsourced figures (percentages used as claims, 'prevents N%', $N million/billion, N million/billion people...);
    # allowed only when the same line links its source (URL, markdown link, <a href> or 'Source:').
    ("unsourced figure (no source on the line)", re.compile(
        r"^(?![^\n]*(?:https?://|\]\(|<a\s[^>]*href=|\bsources?:))[^\n]*?(?:\b\d{1,3}(?:\.\d+)?[ \t]?(?:%|percent)[ \t]+(?:of[ \t]+(?:all[ \t]+)?(?:[\w-]+[ \t]+){0,2}?(?:phishing|scams?|attacks?|breaches|hacks?|accounts?|passwords?|devices?|routers?|cases|incidents|threats|victims|users|people|families|parents|kids|children|teens|households|americans|emails?|wins|attempts|malware|ransomware|data)\b|(?:more|less|fewer|higher|lower|likelier)\b)|\b(?:prevents?|stops?|blocks?|reduces?|cuts?|eliminates?)[ \t]+(?:up[ \t]+to[ \t]+|over[ \t]+|about[ \t]+|nearly[ \t]+|almost[ \t]+)?\d{1,3}(?:\.\d+)?[ \t]?(?:%|percent)|\$[ \t]?\d[\d,.]*[ \t]*(?:million|billion|trillion)\b|\b\d[\d,.]*[ \t]*(?:million|billion)[ \t]+(?:people|users|americans|families|kids|children|teens|accounts|records|households|victims|attacks|scams)\b)", re.I | re.M)),
]
TITLE_LINE_PREFIX = "title: "


# Author-claim words (steering 2026-10-21 4:49 AM ET): never describe Ruel/CDK as expert, pro or professional
# in a post title, meta description (lead) or author line/byline. Generic body uses are left to the P5 guard.
AUTHOR_CLAIM_RULE = ("author-claim word in title/meta/author line", re.compile(
    r"\b(?:experts?|expertise|pros?|professionals?|professional-grade|certified expert)\b", re.I))


def author_claim_guard(post: dict) -> list:
    """Check title, lead (meta description) and the author line/byline for author-claim words."""
    name, rx = AUTHOR_CLAIM_RULE
    out = []
    for field, text in (("title", post.get("title", "")), ("lead/meta", post.get("lead", "")),
                        ("author line", " ".join([AUTHOR_NAME, AUTHOR_TITLE, AUTHOR_BIO]))):
        m = rx.search(text or "")
        if m:
            out.append(f'{name} ({field}): "{m.group(0)}"')
    return out


def title_time_promise_guard(post: dict) -> list:
    """R9i: check the post title as a 'title:' line for minute promises (the body is checked by unverified_stats_guard)."""
    name, rx = next(r for r in UNVERIFIED_STATS_RULES if r[0] == "time promise in title/heading: in N minutes")
    m = rx.search(TITLE_LINE_PREFIX + (post.get("title") or ""))
    return [f'{name} (title): "{m.group(0)}"'] if m else []


def unverified_stats_guard(text: str) -> list:
    """Return the R9 violations found in text (empty list = OK)."""
    out = []
    for name, rx in UNVERIFIED_STATS_RULES:
        m = rx.search(text or "")
        if m:
            out.append(f'{name}: "{m.group(0)}"')
    return out


# Fallback posts — written in a varied, human voice with first-person anecdotes.
# These are deliberately NOT in the same template format so the site reads
# like a real human writing on different days, not a content farm.
FALLBACK_POSTS = [
    {
        "title": "Roblox Settings Most Parents Never Touch (And Should Today)",
        "category": "Gaming Safety",
        "lead": "If your kid plays Roblox, you've probably set the parental PIN and called it a day. I did too. Then I actually opened the privacy panel.",
        "body": (
            "Roblox ships with most privacy settings open by default. That's a deliberate "
            "choice — it makes the platform 'social' out of the box. The downside: any random "
            "account can DM your kid, see their friend list, and invite them into private servers.\n\n"
            "Here's the fix to run on every account in your house:\n\n"
            "**Turn on 2-Step Verification.** Settings → Security → enable it. This single step "
            "blocks the vast majority of account takeovers. If your kid plays on a Chromebook at "
            "school, this matters even more — those accounts get phished constantly.\n\n"
            "**Set messaging to 'Friends' or 'No one.'** Settings → Privacy. There's no good "
            "reason for strangers to be able to message your kid through the platform.\n\n"
            "**Lock the account PIN.** Settings → Security → Account PIN. Your kid won't know "
            "the PIN. That means they can't change privacy settings back without you.\n\n"
            "I'll be honest — my family wasn't thrilled about losing the open chat. But "
            "after I showed them one of the messages from a stranger that came in the previous "
            "week, they got it. Have that conversation with your kid before you change the "
            "settings, not after."
        ),
    },
    {
        "title": "The 'Your Kid Was in a Crash' Phone Scam — What's Actually Happening",
        "category": "Scams",
        "lead": "A friend of mine got the call last month. Sobbing voice, claimed to be his daughter, said she'd been in an accident. The voice was wrong — but only by a little.",
        "body": (
            "AI voice cloning is the reason these scams are exploding right now. Scammers only "
            "need about 10-15 seconds of a person's voice — easily pulled from any TikTok, "
            "Instagram reel, or even a voicemail greeting — to generate a convincing clone.\n\n"
            "The script almost always follows the same pattern. The 'kid' is crying and panicked. "
            "There's a car accident, an arrest, or a hospital. They hand the phone to a 'lawyer' "
            "or 'officer' who needs money fast. Wire transfer. Gift cards. Bitcoin.\n\n"
            "Three things to do today:\n\n"
            "**Set a family safe word.** Pick something only your family knows. Make it weird "
            "enough that it can't be guessed. Anyone calling claiming to be your kid in trouble "
            "must say it. No safe word = scam, full stop.\n\n"
            "**Hang up and call back.** No matter how panicked the caller sounds. Hang up. Call "
            "your kid's actual number. If they don't answer, call the school, a friend, anyone "
            "who can verify before you act.\n\n"
            "**Lock down voicemail greetings.** Replace your kid's voice greetings with the "
            "default robotic one. That's where scammers grab voice samples.\n\n"
            "My friend almost wired the money. He caught it because the 'lawyer' refused to "
            "let him talk to his daughter again. That's the tell. Real situations don't work "
            "that way."
        ),
    },
    {
        "title": "Four Wi-Fi Settings Every Parent Should Change Today",
        "category": "Devices",
        "lead": "Most home routers haven't been touched since the day the cable guy installed them. That's a problem.",
        "body": (
            "Your home Wi-Fi router is the front door for every connected device in the house — "
            "phones, tablets, laptops, smart TVs, doorbells, kids' game consoles, baby monitors. "
            "And most routers ship with security defaults that are years out of date.\n\n"
            "Four changes to make right now. You'll need to log into your router (usually "
            "192.168.1.1 or 192.168.0.1 in your browser).\n\n"
            "**Change the admin password.** Not the Wi-Fi password — the *admin* password used "
            "to log into the router itself. Default is often 'admin' or 'password.' Change it "
            "to something long and unique.\n\n"
            "**Switch to WPA3 encryption.** WPA2 if WPA3 isn't an option. If your router still "
            "uses WEP, anyone within range can crack the password quickly using "
            "free tools.\n\n"
            "**Disable WPS.** It's a 'convenience' feature with a documented vulnerability that "
            "lets attackers brute-force the PIN. You don't need it.\n\n"
            "**Set up a guest network.** Put smart-home devices and visitors on a separate "
            "network from your main one. If a smart bulb gets compromised — and they do — "
            "attackers can't pivot to your laptop or phone.\n\n"
            "Your router is the layer that protects everything else."
        ),
    },
    {
        "title": "The Tween Social Media Privacy Audit: 4 Apps to Check",
        "category": "Social Media",
        "lead": "If your tween is on Instagram, TikTok, Snapchat, or Discord, their account is leaking more info than you realize.",
        "body": (
            "Default settings on these apps favor reach and engagement, not safety. That makes "
            "sense for the platform's business — it doesn't make sense for your kid.\n\n"
            "Sit down with your tween today. Frame it as 'I'm not snooping, I want to make "
            "sure creeps can't find you.' That phrasing tends to land. Then run this audit:\n\n"
            "**Instagram:** Settings → Privacy → Private Account ON. Turn off Activity Status. "
            "'Tag and Mention controls' to People You Follow only.\n\n"
            "**TikTok:** Profile → Settings → Privacy → Private Account. Turn off 'Suggest your "
            "account to others.' Disable Direct Messages from anyone except friends.\n\n"
            "**Snapchat:** Settings → Privacy Controls → set 'Contact Me' and 'View My Story' to "
            "'My Friends.' Turn off Quick Add — that's the feature most tweens get added by "
            "strangers through.\n\n"
            "**Discord:** Settings → Privacy & Safety → enable 'Keep me safe' (scans messages "
            "for explicit content). Disable DMs from server members.\n\n"
            "I do this audit with my own family every six months. The settings drift — apps push "
            "updates that reset preferences, and kids tweak things over time. It's not a one-and-done."
        ),
    },
    {
        "title": "How to Spot a Phishing Email Before Your Kid Clicks It",
        "category": "Scams",
        "lead": "Phishing isn't just an adult problem anymore. Scammers have figured out kids click faster and ask fewer questions.",
        "body": (
            "The new wave of phishing aimed at kids uses fake gaming rewards, fake school login "
            "pages, and fake 'your account has been suspended' emails. The format is cleaner "
            "than a year ago — AI tools have eliminated the broken English that used to be the "
            "obvious tell.\n\n"
            "Teach your kid these four checks before they click anything:\n\n"
            "**Check the full sender address.** Real Roblox emails come from @roblox.com. Fakes "
            "come from things like @roblox-support.net or @rob1ox.com (notice the '1' instead "
            "of 'l'). On phones, tap the sender name to see the full address — kids almost "
            "never do this.\n\n"
            "**Watch for urgency.** 'Your account will be deleted in 24 hours.' 'Claim your "
            "free Robux now.' Real companies don't pressure you. Urgency is the scammer's "
            "main weapon.\n\n"
            "**Never click login links in email.** If something needs your attention, open the "
            "app or website directly and check there. This habit alone stops many phishing "
            "attempts.\n\n"
            "**Hover before tapping.** On a desktop, hover the link. On mobile, long-press. The "
            "actual URL appears. If it doesn't match the sender, it's fake.\n\n"
            "Run through one real email with your kid this week. Show them where to look. That "
            "muscle memory is what protects them — not a rule you read out once."
        ),
    },
    {
        "title": "YouTube Kids Isn't Actually Safe by Default — What I Changed at Home",
        "category": "Privacy",
        "lead": "If your kid lives on kids' YouTube channels, here's what most parents miss about the YouTube Kids app.",
        "body": (
            "In my family it's popular kids' videos and the whole autoplay rabbit "
            "hole. YouTube Kids markets itself as a walled garden — and it mostly is — but "
            "'mostly' is doing a lot of work in that sentence.\n\n"
            "Two things parents miss: the app still serves ads (some of them weirdly targeted), "
            "and the content recommendation algorithm still occasionally surfaces low-quality, "
            "knock-off, or unsettling videos that slip past the filters. The 'Elsagate' problem "
            "from a few years back hasn't been fully solved — it's just gotten more subtle.\n\n"
            "Three settings I changed for my own family:\n\n"
            "**Switch to 'Approved Content Only' mode.** Settings → your child's profile → "
            "'Approved content only.' This flips the model — instead of YouTube deciding what's "
            "okay, you do. Yes, it means more work upfront. It also means no algorithm-driven "
            "surprises.\n\n"
            "**Turn off Search.** In the same profile settings. With Search off, your kid can "
            "only watch the channels and videos you've approved. No discovery, no rabbit hole. "
            "For young kids this is the right call — the 'discovery' use case isn't real for "
            "them yet.\n\n"
            "**Disable autoplay.** Each session, tap the autoplay toggle off. Autoplay is the "
            "single biggest driver of kids ending up on weird content — they finish a normal "
            "kids' video and the next one starts before anyone's reviewing it.\n\n"
            "From a threat-model perspective, YouTube Kids is collecting behavioral data on a "
            "minor. That's a privacy concern, not just a content concern. These three settings "
            "tighten both at once."
        ),
    },
]

# -------- HELPERS --------

def slugify(title: str) -> str:
    s = title.lower()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s.strip())
    return s[:60].strip("-") or "post"


def load_log() -> set:
    if LOG_FILE.exists():
        try:
            return set(json.loads(LOG_FILE.read_text()))
        except Exception:
            return set()
    return set()


def save_log(log: set) -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    LOG_FILE.write_text(json.dumps(sorted(log), indent=2))


def already_posted_today() -> bool:
    today = datetime.date.today().isoformat()
    if not POSTS_DIR.exists():
        return False
    return any(POSTS_DIR.glob(f"{today}-*.md"))


def post_exists(slug: str) -> bool:
    if not POSTS_DIR.exists():
        return False
    return any(POSTS_DIR.glob(f"*-{slug}.md"))


def reading_time_minutes(text: str) -> int:
    words = len(text.split())
    return max(1, round(words / 220))


# -------- CISA + AI --------

def fetch_cisa_alert():
    """Try each CISA feed in order until one returns a family-relevant alert."""
    for url in CISA_FEEDS:
        try:
            feed = feedparser.parse(url)
            if not feed.entries:
                continue
            for entry in feed.entries[:25]:
                blob = (entry.title + " " + entry.get("summary", "")).lower()
                if any(kw in blob for kw in FAMILY_KEYWORDS):
                    return {
                        "title": entry.title,
                        "summary": entry.get("summary", ""),
                        "link": entry.get("link", ""),
                        "source_feed": url,
                        "published": entry.get("published", ""),
                    }
        except Exception as e:
            print(f"CISA feed {url} error: {e}")
            continue
    return None


def translate_with_ai(alert: dict):
    """Translate a CISA alert into a parent-friendly post — varied voice."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("No OPENAI_API_KEY set — skipping AI translation.")
        return None

    client = OpenAI(api_key=api_key)

    # Rotate the voice so posts don't all sound identical
    voices = [
        "Conversational, like talking to another parent at school pickup",
        "Direct and a bit blunt, like a friend who works in IT",
        "Calm and reassuring, like a school counselor",
        "Slightly skeptical, like an older sibling who's seen the scams before",
        "Calm and precise, like a parent walking another parent through official guidance step by step",
    ]
    voice = random.choice(voices)

    prompt = f"""You are writing for CyberDadKit, a family cybersecurity blog by Ruel Miller, a U.S. Marine Corps veteran and CompTIA Security+ certified dad with hands-on Security Operations Center experience, who built CyberDadKit to help families protect themselves online. He writes for parents who want official FBI, FTC, and CISA guidance translated into plain-English steps for home.

Take this CISA cybersecurity alert and turn it into a 350-word post for parents.

VOICE: {voice}
RULES:
- Write in first person where natural ("I noticed", "CISA's advisory says...", "in my house we..."). If you mention Ruel's background, use ONLY these facts, in the past tense for SOC work: U.S. Marine Corps veteran; CompTIA Security+; past hands-on Security Operations Center experience (e.g., "when I worked in a SOC"). NEVER say or imply he currently works in a SOC or as an analyst. NEVER name, describe, or hint at any employer, agency, contractor, or client. NEVER use the words "expert", "professional", "pro", or any number of years of experience. NEVER state or imply the author's child's or children's age, gender, name, or school, or how many children he has; refer to his household only as "my family".
- Where it fits naturally, explain what the official advisory means for a home network and link the source (CISA, FBI/IC3, or FTC)
- No corporate hedge phrases ("It's important to note", "in today's digital age")
- Lead with one specific scenario, not a definition
- Give 3 concrete actions a parent can take today
- Do not promise how many minutes something takes, do not use the words instant, tonight, expert or pro, and do not cite statistics without a named source.
- End with a one-line reassurance, not a generic platitude

ALERT TITLE: {alert['title']}
ALERT SUMMARY: {alert['summary']}

Respond in this exact format:
TITLE: [punchy parent-friendly title, max 60 chars, no clickbait]
CATEGORY: [one of: Scams, Privacy, Gaming Safety, Social Media, Devices]
LEAD: [a single one-sentence hook, ~20 words, sets the scene]
---
[Body — 300-350 words. Use markdown bold for the 3 action steps.]
"""
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000,
            temperature=0.85,
        )
        text = resp.choices[0].message.content.strip()
        title = re.search(r"TITLE:\s*(.+)", text)
        cat = re.search(r"CATEGORY:\s*(.+)", text)
        lead = re.search(r"LEAD:\s*(.+)", text)
        body = re.search(r"---\s*(.+)", text, re.DOTALL)
        if not (title and cat and body):
            print("AI response format unexpected.")
            return None
        return {
            "title": title.group(1).strip().strip('"'),
            "category": cat.group(1).strip(),
            "lead": (lead.group(1).strip() if lead else ""),
            "body": body.group(1).strip(),
        }
    except Exception as e:
        print(f"OpenAI error: {e}")
        return None


def get_fallback_post(log: set):
    """Pick a fallback post that hasn't been used yet."""
    for fp in FALLBACK_POSTS:
        slug = slugify(fp["title"])
        if slug not in log and not post_exists(slug):
            return fp
    return FALLBACK_POSTS[0]


# -------- IMAGE GENERATION --------

COLOR_SCHEMES = [
    {"bg": (15, 23, 42),  "accent": (239, 68, 68),  "text": (255, 255, 255)},
    {"bg": (88, 28, 135), "accent": (251, 191, 36), "text": (255, 255, 255)},
    {"bg": (7, 89, 133),  "accent": (34, 197, 94),  "text": (255, 255, 255)},
    {"bg": (127, 29, 29), "accent": (251, 146, 60), "text": (255, 255, 255)},
]


def load_font(size: int):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def generate_pin_image(title: str, slug: str) -> Path:
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    out_path = IMAGES_DIR / f"{slug}.png"

    width, height = 1000, 1500
    idx = int(hashlib.md5(slug.encode()).hexdigest(), 16) % len(COLOR_SCHEMES)
    s = COLOR_SCHEMES[idx]

    img = Image.new("RGB", (width, height), s["bg"])
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, width, 100], fill=s["accent"])
    draw.rectangle([0, height - 100, width, height], fill=s["accent"])
    draw.rectangle([60, 140, 120, 200], fill=s["accent"])
    draw.rectangle([width - 120, height - 200, width - 60, height - 140], fill=s["accent"])

    title_font = load_font(78)
    eyebrow_font = load_font(44)
    cta_font = load_font(56)
    brand_font = load_font(38)

    eyebrow = "PARENTS — READ THIS"
    bbox = draw.textbbox((0, 0), eyebrow, font=eyebrow_font)
    draw.text(((width - (bbox[2] - bbox[0])) / 2, 240), eyebrow, fill=s["accent"], font=eyebrow_font)

    lines = textwrap.wrap(title, width=18)
    if len(lines) > 5:
        lines = lines[:5]
        lines[-1] = lines[-1].rstrip().rstrip(",.;") + "..."
    line_height = 100
    block_h = len(lines) * line_height
    y_start = (height - block_h) / 2 - 30

    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=title_font)
        x = (width - (bbox[2] - bbox[0])) / 2
        y = y_start + i * line_height
        draw.text((x, y), line, fill=s["text"], font=title_font)

    cta = "FREE GUIDE INSIDE"
    bbox = draw.textbbox((0, 0), cta, font=cta_font)
    draw.text(((width - (bbox[2] - bbox[0])) / 2, height - 290), cta, fill=s["accent"], font=cta_font)

    brand = "CyberDadKit"
    bbox = draw.textbbox((0, 0), brand, font=brand_font)
    draw.text(((width - (bbox[2] - bbox[0])) / 2, height - 200), brand, fill=s["text"], font=brand_font)

    img.save(out_path, "PNG", optimize=True)
    return out_path


# -------- POST WRITING --------

class PostBlocked(Exception):
    """Raised when a rendered post fails the R9 guard; nothing is written."""


def rendered_post_guard(content: str) -> list:
    """R9n: run the minute / tonight / unsourced-figure (all R9) rules on the full post exactly as it would be written."""
    return unverified_stats_guard(content)


def write_post(post: dict, slug: str, image_path: Path, source: dict | None) -> Path:
    filename, content = render_post(post, slug, image_path, source)
    violations = rendered_post_guard(content)
    if violations:
        raise PostBlocked("; ".join(violations))
    POSTS_DIR.mkdir(parents=True, exist_ok=True)
    filename.write_text(content)
    return filename


def render_post(post: dict, slug: str, image_path: Path, source: dict | None):
    """Build (filename, file content) without writing anything."""
    category = post.get("category") or "Family Safety"
    today = datetime.date.today().isoformat()
    filename = POSTS_DIR / f"{today}-{slug}.md"
    image_url = f"{SITE_URL}/{image_path.as_posix()}"

    safe_title = post["title"].replace('"', "'")
    lead = post.get("lead", "")
    full_text = f"{lead}\n\n{post['body']}"
    rt = reading_time_minutes(full_text)

    # Source citation block — only if we have a real CISA source
    source_block = ""
    if source and source.get("link"):
        published = source.get("published", "").split("T")[0] or "recent advisory"
        source_block = (
            f"\n\n---\n\n"
            f"**Source:** This post is based on a public advisory from "
            f"[CISA (Cybersecurity and Infrastructure Security Agency)]({source['link']}) "
            f"published {published}. CISA is the U.S. federal agency responsible for "
            f"cybersecurity threat intelligence."
        )

    # Author footer — the human signature is the strongest E-E-A-T signal
    author_footer = (
        f"\n\n---\n\n"
        f"**Written by {AUTHOR_NAME}** — {AUTHOR_TITLE}. "
        f"{AUTHOR_BIO} "
        f"Reach Ruel directly at [{AUTHOR_EMAIL}](mailto:{AUTHOR_EMAIL}). "
        f"Last reviewed: {today}."
    )

    cta_block = (
        f"\n\n---\n\n"
        f"**Want the full system?** [Get the Shield Kit]({SITE_URL}/#kit) — "
        f"the complete family cybersecurity playbook in one place."
    )

    content = f"""---
title: "{safe_title}"
date: {today}
last_modified_at: {today}
author: {AUTHOR_NAME}
author_slug: {AUTHOR_SLUG}
categories: [Cybersecurity, {category}]
tags: [family safety, {category.lower()}, parents]
image: /{image_path.as_posix()}
description: "{lead[:155] if lead else safe_title}"
reading_time: {rt}
---

<div style="text-align: center; margin: 1.5rem 0;"><img src="{image_url}" alt="{safe_title}" style="max-width: 180px; width: 100%; height: auto;" /></div>
{lead}

{post['body']}{source_block}{author_footer}{cta_block}
"""

    return filename, content


# -------- MAIN --------

def main():
    if already_posted_today():
        print("Already posted today — skipping.")
        return

    log = load_log()

    post = None
    source = None
    alert = fetch_cisa_alert()
    if alert:
        print(f"Found CISA alert: {alert['title'][:80]}")
        post = translate_with_ai(alert)
        if post:
            source = alert  # remember the citation

    if not post:
        print("Using fallback post.")
        post = get_fallback_post(log)

    slug = slugify(post["title"])

    if slug in log or post_exists(slug):
        print(f"Post '{slug}' already exists — skipping.")
        return

    stat_violations = (unverified_stats_guard(" ".join([post["title"], post.get("lead", ""), post["body"]]))
                       + title_time_promise_guard(post) + author_claim_guard(post))
    # R9n: also guard the full post exactly as write_post() would write it (front matter, body, source, footer, CTA),
    # before the image is generated, so a failing post leaves no file behind.
    _, rendered = render_post(post, slug, IMAGES_DIR / f"{slug}.png", source)
    stat_violations += [v for v in rendered_post_guard(rendered) if v not in stat_violations]
    if stat_violations:
        print("Post blocked by R9 guard (unverified stats / author-claim words), nothing written: " + "; ".join(stat_violations))
        return

    print("Generating Pinterest image...")
    image_path = generate_pin_image(post["title"], slug)

    print("Writing post...")
    try:
        filename = write_post(post, slug, image_path, source)
    except PostBlocked as e:
        print("Post blocked by R9 guard at write time, nothing written: " + str(e))
        return
    print(f"Wrote {filename}")

    log.add(slug)
    save_log(log)
    print("Done.")


if __name__ == "__main__":
    main()
