# Session Guard — demo video (Remotion)

1920×1080, 30 fps, **2:55**. Built as a motion-graphic ad with five slots for
real simulator recordings. The current draft uses the real testnet captures in
`public/` as placeholders, so nothing is mocked or illustrated.

## Structure

| Time | Section | What it does |
|---|---|---|
| 0:00–0:15 | Hook | kinetic type: liquidation while you're away from the screen |
| 0:15–0:35 | Reveal | Session Guard HUD on a stylised Even G2 panel |
| 0:35–2:10 | Proof | five real simulator slots, callouts mapped to the judging criteria |
| 2:10–2:40 | Safety | host gate, server-side keys, token + preview + Yes, WebSocket feed |
| 2:40–2:55 | CTA | wordmark, Track 03, repo placeholder |

Captions for every VO line are built in (`src/captions.ts`) and stay on screen
with sound off. No audio is included by default; the renders are silent.

## Commands

```bash
cd video
npm install
npx remotion studio src/index.ts          # preview
npx remotion still src/index.ts SessionGuard out/frame.png --frame=780
npx remotion render src/index.ts SessionGuard out/session-guard.mp4 --crf 23
```

Render straight to the submission folder:

```bash
mkdir -p ~/Downloads/mandor/hackathons/even-realities/video
npx remotion render src/index.ts SessionGuard \
  ~/Downloads/mandor/hackathons/even-realities/video/session-guard-draft.mp4 \
  --crf 23
```

## Recording slots

Drop the five recordings into `video/public/clips/`, then edit
`src/config.ts` (`kind: 'video'`, `src: 'clips/<file>.mp4'`). Keep every
`durationInFrames` value; Remotion trims or loops the clip to the slot.

| # | File | Video time | Frames | Record this |
|---|---|---|---|---|
| 01 | `01-hud.mp4` | 0:35–0:53 | 540 | HUD idle with live PnL; hold still, let the number tick |
| 02 | `02-voice.mp4` | 0:53–1:13 | 600 | hold the temple, say “alert sixty-two thousand”, release, alert-set screen |
| 03 | `03-alert.mp4` | 1:13–1:30 | 510 | the ALERT HIT screen; tap to dismiss at the end |
| 04 | `04-confirm.mp4` | 1:30–1:53 | 690 | hold, “close half”, release, confirm screen; swipe to Yes and pause before tapping |
| 05 | `05-fill.mp4` | 1:53–2:10 | 510 | the FILLED screen after the order |

Recording notes:

- Capture the glasses canvas only (576×288), or the simulator at 2×/4×. No
  desktop chrome, no notifications.
- 30 fps, no audio needed; the video discards clip audio (`muted`).
- Use the real testnet position. If the market is flat, the HUD still reads
  correctly; the fill slot needs an actual order.
- The confirm slot is the safety proof: show the default **No**, then the swipe
  to **Yes**. Do not cut straight to the fill.
- Record a few seconds longer than the slot so there is room to trim.
- If a recording is missing, the placeholder image stays — the video is still
  valid, just less alive.

## Swapping a slot

```ts
// src/config.ts
{
  id: 'confirm',
  kind: 'video',                 // was 'image'
  src: 'clips/04-confirm.mp4',   // was 'confirm.png'
  durationInFrames: 690,         // keep this
  // title, kicker, chips, highlight stay the same
}
```

The image placeholders are `position.png`, `listening.png`, `alert.png`,
`confirm.png`, `filled.png` — all real testnet captures from 23 Nov.

## Music and voiceover

Neither is bundled (no copyrighted music). To add them:

- **Music:** put a licensed track at `video/public/music.mp3`, then render with
  `--props='{"music":true}'`. Volume is set to 0.32 in `src/SessionGuard.tsx`.
- **Voiceover:** put `video/public/vo.mp3` (2:55), render with
  `--props='{"voiceover":true}'`. Captions already follow the script in
  `docs/demo-script.md`, so the VO must match those lines or the captions need
  updating in `src/captions.ts`.

## Repo link

The CTA shows a placeholder. Set the real URL at render time:

```bash
npx remotion render src/index.ts SessionGuard out/session-guard.mp4 \
  --props='{"repo":"github.com/<owner>/session-guard","music":false}'
```

Props are validated against `defaultProps` in `src/config.ts`.

## Files

```
src/
  SessionGuard.tsx    timeline + audio slots
  config.ts           proof slots, props, durations
  captions.ts         every VO line with frame times
  timeline.ts         0:00 / 0:15 / 0:35 / 2:10 / 2:40 boundaries
  scenes/             Hook, Reveal, Proof, Safety, CTA
  components/         Backdrop, HUD mock, device frame, captions
public/               real testnet captures + clips/ slot folder
```
