#!/usr/bin/env python3
"""Build the v4 VO schedule, word-synced captions and phrase cues.

Reads the ElevenLabs alignment written by generate-vo-v4.py and writes
src/voV4.generated.ts. Captions are 2-7 word chunks of the exact spoken text,
timed from the first and last word in each chunk. Nothing is sped up; the
schedule gives every line the earliest free slot and reports overruns against
the script windows.
"""
import json
import math
from pathlib import Path
from typing import List

HERE = Path(__file__).resolve().parent
VIDEO = HERE.parent
OUT = VIDEO / "src" / "voV4.generated.ts"
FPS = 30

# Absolute start of every line, in seconds. b5 starts when b4 has finished,
# inside the 25-41 s close-half beat; b7/b8 move with the speech so the last
# line still ends before 60 s.
BEATS = [
    ("v4-1", 0.00, (0, 8)),
    ("v4-2", 8.00, (8, 14)),
    ("v4-3", 14.60, (14, 21)),
    ("v4-4", 22.60, (21, 25)),
    ("v4-5", 25.90, (25, 41)),
    ("v4-6", 41.00, (41, 48)),
    ("v4-7", 46.40, (48, 51)),
    ("v4-8", 49.90, (51, 60)),
]

# Caption chunks are 2-7 words, split on the spoken phrasing (quoted commands
# stay whole; no chunk crosses a sentence into a one-word tail). Values are
# 0-based word indices in the beat.
MANUAL_SPLITS = {
    "v4-1": [0, 5, 12, 17],
    "v4-2": [0, 6, 13],
    "v4-3": [0, 2, 5, 9, 12],
    "v4-4": [0, 3, 7],
    "v4-5": [0, 3, 9, 11, 15, 20, 24, 28],
    "v4-6": [0, 3, 6, 11],
    "v4-7": [0, 7],
    "v4-8": [0, 2, 4, 9, 13, 17],
}


def frames(seconds: float) -> int:
    return round(seconds * FPS)


def clean(word: str) -> str:
    return word.strip()


def chunks_for(beat_id: str, words: list[dict]) -> list[list[dict]]:
    if beat_id in MANUAL_SPLITS:
        cuts = [0] + MANUAL_SPLITS[beat_id] + [len(words)]
        return [words[a:b] for a, b in zip(cuts, cuts[1:]) if a < b]

    groups: list[list[dict]] = []
    cur: list[dict] = []
    for w in words:
        cur.append(w)
        end = w["word"][-1] in ".?!:"
        if end:
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)

    out: list[list[dict]] = []
    for group in groups:
        while len(group) > 7:
            # Prefer a comma near the middle, otherwise split at the midpoint.
            commas = [i + 1 for i, w in enumerate(group[:-1]) if w["word"].endswith(",")]
            target = len(group) / 2
            cut = min(commas, key=lambda i: abs(i - target)) if commas else round(target)
            cut = max(3, min(7, cut))
            out.append(group[:cut])
            group = group[cut:]
        if group:
            out.append(group)
    # A one-word tail reads badly; borrow a word when the previous chunk can spare one.
    merged: list[list[dict]] = []
    for group in out:
        if len(group) == 1 and merged and len(merged[-1]) > 2:
            merged[-1].append(group[0])
        else:
            merged.append(group)
    return merged


def find(words: list[dict], text: str) -> float:
    target = text.lower().strip('"').strip()
    for w in words:
        if w["word"].lower().strip('"').strip(".,?!:").strip() == target:
            return w["start"]
    raise SystemExit(f"cue word not found: {text!r}")


def find_phrase(words: list[dict], phrase: List[str]) -> float:
    """First word-start of a multi-word phrase, matched on cleaned tokens."""
    want = [p.lower().strip('"').strip(".,?!:").strip() for p in phrase]
    have = [w["word"].lower().strip('"').strip(".,?!:").strip() for w in words]
    for i in range(len(have) - len(want) + 1):
        if have[i : i + len(want)] == want:
            return words[i]["start"]
    raise SystemExit(f"cue phrase not found: {phrase!r}")


def main() -> None:
    report = []
    clips = []
    captions = []
    cues = {}
    absolute_words = {}

    for beat_id, start, window in BEATS:
        data = json.loads((VIDEO / "public" / "vo" / f"{beat_id}.json").read_text())
        words = data["words"]
        end = start + data["seconds"]
        clips.append((beat_id, start, end))
        absolute = [
            {"word": clean(w["word"]), "start": round(start + w["start"], 3), "end": round(start + w["end"], 3)}
            for w in words
        ]
        absolute_words[beat_id] = absolute
        for group in chunks_for(beat_id, words):
            from_s = start + group[0]["start"]
            to_s = start + group[-1]["end"]
            captions.append({
                "from": frames(from_s),
                "to": max(frames(from_s) + 1, frames(to_s)),
                "text": " ".join(clean(w["word"]) for w in group),
                "words": [
                    {
                        "word": clean(w["word"]),
                        "start": frames(start + w["start"]),
                        "end": max(frames(start + w["start"]) + 1, frames(start + w["end"])),
                    }
                    for w in group
                ],
            })
        report.append({
            "id": beat_id,
            "start": start,
            "end": round(end, 3),
            "seconds": data["seconds"],
            "window": window,
        })

    # Phrase cues used by the visuals. Times are absolute seconds.
    b3 = absolute_words["v4-3"]
    b5 = absolute_words["v4-5"]
    b6 = absolute_words["v4-6"]
    b8 = absolute_words["v4-8"]
    cues["alertSay"] = find_phrase(b3, ["Say", '"alert'])
    cues["alertArmed"] = find_phrase(b3, ["and", "it's"])
    cues["closeSay"] = find_phrase(b5, ["Say", '"close'])
    cues["closePreview"] = find_phrase(b5, ["WickSight", "shows"])
    cues["closeDefaultNo"] = find_phrase(b5, ["The", "default"])
    cues["closeSwipe"] = find_phrase(b5, ["Swipe", "to"])
    cues["closeYes"] = find_phrase(b5, ["Yes,"])
    cues["closeTap"] = find_phrase(b5, ["tap", "once"])
    cues["closeFill"] = find_phrase(b5, ["fills", "on"])
    cues["closeTestnet"] = find_phrase(b5, ["testnet"])
    cues["receiptBuffer"] = find_phrase(b6, ["your", "buffer"])
    cues["safeKeys"] = find_phrase(b8, ["Trade-only", "keys."])
    cues["safeWithdraw"] = find_phrase(b8, ["Withdrawals", "refused."])
    cues["safeNothing"] = find_phrase(b8, ["Nothing", "moves"])
    cues["wordmark"] = find_phrase(b8, ["WickSight:"])

    lines = [
        "// Generated by scripts/build-vo-v4.py from public/vo/v4-*.json.",
        "// Do not edit by hand; rerun the script after regenerating the VO.",
        "",
        "export interface Word {",
        "  word: string",
        "  start: number",
        "  end: number",
        "}",
        "",
        "export interface Caption1Min {",
        "  from: number",
        "  to: number",
        "  text: string",
        "  words: Word[]",
        "}",
        "",
        "export const VO_CLIPS = [",
    ]
    for beat_id, start, end in clips:
        start_f = frames(start)
        # Round the tail up: the MP3 ends on its own silence, never clipped.
        lines.append(
            f"  {{ file: 'vo/{beat_id}.mp3', from: {start_f}, frames: {math.ceil(end * FPS) - start_f}, name: '{beat_id}' }},"
        )
    lines += ["] as const", "", "export const CAPTIONS_1MIN: Caption1Min[] = ["]
    for c in captions:
        text = c["text"].replace("'", "\\'")
        lines.append(f"  {{ from: {c['from']}, to: {c['to']}, text: '{text}', words: [")
        for w in c["words"]:
            wt = w["word"].replace("'", "\\'")
            lines.append(f"    {{ word: '{wt}', start: {w['start']}, end: {w['end']} }},")
        lines.append("  ] },")
    lines += ["]", "", "/** Absolute frame number for each spoken cue. */", "export const CUES = {"]
    for k, v in cues.items():
        lines.append(f"  {k}: {frames(v)},")
    lines += ["} as const", ""]
    OUT.write_text("\n".join(lines))
    print(f"wrote {OUT} ({len(captions)} captions)")
    for c in captions:
        print(f"  {c['from']:4d}-{c['to']:4d}  {c['text']}")
    print("cues:", {k: frames(v) for k, v in cues.items()})

    print("\nwindow check:")
    for r in report:
        lo, hi = r["window"]
        over = r["end"] - hi
        print(
            f"  {r['id']}: {r['start']:6.2f}-{r['end']:6.2f}s "
            f"(script {lo}-{hi}s, {'over by %.2fs' % over if over > 0 else 'fits'})"
        )


if __name__ == "__main__":
    main()
