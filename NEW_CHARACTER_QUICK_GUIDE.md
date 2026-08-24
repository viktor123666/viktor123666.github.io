# 🟢 NEW CHARACTER QUICK GUIDE

The goal: **add a new family character in under 15 minutes** using the cheapest, fastest path.

---

## 🔑 The big shortcut nobody tells you: YouTube Brand Channels

**You do NOT need a new Google account per character.**

One Google account can manage ~5-10 separate YouTube **brand channels**, each with its own
handle, branding, OAuth, and analytics. That means your 5 existing Gmails (viggeee2, 3, 6, 11, 13)
can spawn **30+ YouTube channels** without ever creating a new email at Google.

How: https://myaccount.google.com/brandaccounts → "Create a brand account" →
that account becomes a new YouTube channel under your existing login.

---

## 🌐 The OTHER big shortcut: Cloudflare Email Routing

Free. 5 minutes to set up. Gives you UNLIMITED email addresses on your domain
(`isa@scalelistuniverse.com`, `opha@scalelistuniverse.com`, etc.) all forwarding to ONE inbox.

**Bluesky / Discord / TikTok / Instagram / Dailymotion — all accept these custom emails.**
You only need real Gmail for YouTube (and the brand-channel trick fixes that).

### Setup (one-time, then forget it forever)

1. Go to https://dash.cloudflare.com → click `scalelistuniverse.com` domain
2. Sidebar → **Email** → **Email Routing**
3. Click **Get Started** → confirm DNS records (Cloudflare auto-adds them)
4. Add a **custom address** like `isa@scalelistuniverse.com` → forward to `vigge.holmstrom@gmail.com`
5. OR (better) add a **catch-all** rule: `*@scalelistuniverse.com` → forward to your inbox.
   Now ANY name works (`opha@`, `runa@`, `tova@` — all just appear in Gmail). Done forever.

---

## 🪜 The 8-step path per character (15 minutes total)

For each new family member you want to honor:

### Step 1 — Run the wizard (60 seconds)

```powershell
& "F:\scalelistuniverse\tools\autoedit\venv\Scripts\python.exe" -X utf8 "F:\scalelistuniverse\tools\new_character.py"
```

Answer the prompts (use canon names from the lineage: isa, opha, runa, ogar, niva, njord, kvar, vidar, iska, tova).
This adds them to the central registry. Every dashboard auto-updates the next refresh.

### Step 2 — Discord channel (60 seconds)

In your Scalelist Discord server:
- New text channel named `#<char>-feed`
- Channel settings → Integrations → Webhooks → New Webhook → name it "Posting Hub"
- Copy URL → paste into `.env` as:
  ```
  DISCORD_WEBHOOK_<CHAR>="https://discord.com/api/webhooks/..."
  ```

### Step 3 — Bluesky (3 minutes)

- Go to https://bsky.app → sign up with `<char>@scalelistuniverse.com` (your Cloudflare-routed address)
- Pick handle: `scalelist<char>.bsky.social`
- Verify email (link arrives in your main inbox via Cloudflare)
- Settings → Privacy & Security → **App passwords** → Add → copy 19-char string
- Add to `.env`:
  ```
  BLUESKY_HANDLE_<CHAR>="scalelist<char>.bsky.social"
  BLUESKY_APP_PASSWORD_<CHAR>="xxxx-xxxx-xxxx-xxxx"
  ```

### Step 4 — YouTube brand channel (4 minutes)

- Sign in to one of your existing Google accounts (pick one with <5 brand channels already)
- Go to https://myaccount.google.com/brandaccounts → **Create brand account**
- Name it `Scalelist <Char>` → Create
- This creates a new YouTube channel — go to https://youtube.com → switch to the brand
- Edit handle: `@scalelist<char>` → save
- Run:
  ```powershell
  & "F:\scalelistuniverse\tools\autoedit\venv\Scripts\python.exe" -X utf8 "F:\scalelistuniverse\tools\youtube_uploader.py" auth --channel <char>
  ```
- Browser opens → pick the brand account in the chooser → accept → token saved.

### Step 5 — Instagram (3 minutes)

- Mobile IG app → sign up with `<char>@scalelistuniverse.com` (or use the same email — IG allows it via reverification)
- Username: `scalelist<char>`
- Convert to **Business** (Settings → Account type)
- Once logged in, run on PC:
  ```powershell
  & "F:\scalelistuniverse\tools\autoedit\venv\Scripts\python.exe" -X utf8 "F:\scalelistuniverse\tools\instagram_reels_uploader.py" --login scalelist<char>
  ```
- A Chrome window opens — sign in once. The session saves to `tools/social_creds/ig_profiles/scalelist<char>/`.

### Step 6 — TikTok (3 minutes)

- https://tiktok.com/signup → sign up with `<char>@scalelistuniverse.com`
- Username: `scalelist<char>`
- Verify by SMS (sadly TT requires phone — you can use the same number across 3-5 accounts before it blocks)
- Run on PC:
  ```powershell
  & "F:\scalelistuniverse\tools\autoedit\venv\Scripts\python.exe" -X utf8 "F:\scalelistuniverse\tools\tiktok_uploader.py" --login <char>
  ```

### Step 7 — Pick a VTuber source for clip-ripping

Edit `F:\scalelistuniverse\tools\stream_ripper\vtuber_config.json` → add a routing entry:

```json
"VTuber Name Here": { "channel": "<char>", "reason": "added <char> 2026-05-XX" }
```

Pick someone the family member would vibe with — search YouTube for `vtuber [their interests]`.

### Step 8 — Voice clone (when you have time, OPTIONAL but recommended)

Record 1-2 min of yourself doing the character's voice (any phone mic, save as MP3).
Drop in a folder like `F:\scalelistuniverse\voice_samples\<char>\`.

```powershell
& "F:\scalelistuniverse\tools\autoedit\venv\Scripts\python.exe" -X utf8 "F:\scalelistuniverse\tools\clone_voice.py"
```

Pick the char shortcut, paste the folder path, done. Voice ID saves to registry — `ai_commentary.py` uses it automatically.

---

## ⏱ Realistic time per character

| Phase | Time | Pain | Required? |
|---|---|---|---|
| Wizard + .env edit + Discord | **2 min** | none | yes |
| Bluesky | 3 min | low | yes (huge reach) |
| YouTube brand channel + OAuth | 4 min | low | yes |
| Instagram | 3 min | medium (IG hates new accounts) | optional |
| TikTok | 3 min | medium (SMS verify) | optional |
| VTuber routing | 30 sec | none | yes (no clips otherwise) |
| Voice clone | 5 min when ready | none | optional |
| **Minimum viable** | **10 min** | | YT + BS + DC + routing |
| **Full setup** | **20 min** | | all 5 platforms |

---

## 📋 Order I'd add the 10 open canon characters in

Based on canon weight + how easy each is to play visually:

1. **Isa** — quiet, time-still power. Easy aesthetic (frozen lake, snow). Lineage VIKTOR-2.
2. **Tova** — herald, brass horn. Loud, attention-grabbing. RÖNNKVIST-9. Great for hype.
3. **Runa** — first rune-speaker. Mystical aesthetic. RÖNNKVIST-1. Pairs well with Trollmage.
4. **Iska** — spark-carrier, joy-flame. Warm aesthetic. RÖNNKVIST-7.
5. **Opha** — conjunction, two-truths. Pink/dawn aesthetic. VIKTOR-5.
6. **Njord** — tide-reader, heartbeat coast. Blue/water. RÖNNKVIST-4.
7. **Vidar** — silent reckoner, void-ii. Dark aesthetic. RÖNNKVIST-6.
8. **Ögar** — far-eye watcher. Grey/blindfold. RÖNNKVIST-2.
9. **Niva** — untraversed, NULL realm. White/abstract. RÖNNKVIST-3.
10. **Kvar** — last-one. Silver/lonely. RÖNNKVIST-5.

Top 3 (Isa, Tova, Runa) is enough to validate the workflow. Once that takes <15min per char,
the rest scale to 1 per day.

---

## 🆘 If anything breaks

- Wizard says "key already exists" → pick a different key or delete from `characters.json`
- YouTube OAuth opens browser then 401s → token issue, see `BREAK_GLASS.md`
- IG playwright fails → cookies expired, re-run `--login <char>`
- TikTok cookies dead → same fix, re-run `--login <char>`
- Anything else → ping me. Fastest unblock is "powershell command?" and I'll cough one up.

---

## 🎯 The 30-second decision tree

> "I want to add a new character right now."

1. Got 2 minutes? → run the wizard, do Step 1 only. Char appears in dashboards. Comeback later.
2. Got 10 minutes? → wizard + Discord webhook + Bluesky + YouTube brand channel + VTuber routing.
3. Got 20 minutes? → all 8 steps. Full firepower out of the box.

Whatever path: the wizard's "next steps" output prints exactly what to do.
