#!/usr/bin/env python3
"""Generate the v4 voiceover with ElevenLabs word timestamps.

Uses the with-timestamps endpoint so captions can follow the spoken words
exactly. The API key is read from the Kota Kita env and never printed.
"""
import argparse
import base64
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
VIDEO = HERE.parent
OUT = VIDEO / "public" / "vo"
DEFAULT_LINES = VIDEO / "vo" / "lines-v4.json"
DEFAULT_ENV = Path("/Users/user/Code/kota-kita/tools/tts/.env")
VOICE = "onwK4e9ZLuTAKqWW03F9"


def api_key(path: Path) -> str:
    for line in path.read_text().splitlines():
        if line.startswith("ELEVENLABS_API_KEY="):
            key = line.split("=", 1)[1].strip()
            if key.startswith("sk_"):
                return key
    sys.exit("ELEVENLABS_API_KEY not found")


def duration(path: Path) -> float:
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]
    ))


def normalize(path: Path) -> None:
    """Bring the clip to the same ~-16 LUFS target as the v3 voice."""
    tmp = path.with_suffix(".norm.mp3")
    subprocess.check_call(
        [
            "ffmpeg", "-y", "-v", "error", "-i", str(path),
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=7",
            "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "192k",
            str(tmp),
        ]
    )
    tmp.replace(path)


def words_from_alignment(alignment: dict) -> list[dict]:
    chars = alignment["characters"]
    starts = alignment["character_start_times_seconds"]
    ends = alignment["character_end_times_seconds"]
    words: list[dict] = []
    cur = ""
    start = None
    last = 0.0
    for ch, s, e in zip(chars, starts, ends):
        if ch.isspace():
            if cur:
                words.append({"word": cur, "start": round(start, 3), "end": round(last, 3)})
                cur = ""
                start = None
        else:
            if start is None:
                start = s
            cur += ch
            last = e
    if cur:
        words.append({"word": cur, "start": round(start, 3), "end": round(last, 3)})
    return words


def tts(key: str, text: str) -> dict:
    body = {
        "text": text,
        "model_id": "eleven_v3",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.3},
    }
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128",
        data=json.dumps(body).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "application/json"},
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(3 * (attempt + 1))
                continue
            sys.exit(f"ElevenLabs error {e.code}: {msg}")
        except urllib.error.URLError:
            if attempt < 3:
                time.sleep(3 * (attempt + 1))
                continue
            sys.exit("ElevenLabs network error")
    sys.exit("ElevenLabs failed")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lines", type=Path, default=DEFAULT_LINES)
    ap.add_argument("--env-file", type=Path, default=DEFAULT_ENV)
    ap.add_argument("--only", default="")
    args = ap.parse_args()

    spec = json.loads(args.lines.read_text())
    key = api_key(args.env_file)
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    OUT.mkdir(parents=True, exist_ok=True)

    report = {}
    for beat in spec["beats"]:
        if only and beat["id"] not in only:
            continue
        data = tts(key, beat["text"])
        audio = OUT / f"{beat['id']}.mp3"
        audio.write_bytes(base64.b64decode(data["audio_base64"]))
        normalize(audio)
        words = words_from_alignment(data["alignment"])
        seconds = duration(audio)
        payload = {
            "id": beat["id"],
            "window": beat["window"],
            "text": beat["text"],
            "seconds": round(seconds, 3),
            "words": words,
        }
        (OUT / f"{beat['id']}.json").write_text(json.dumps(payload, indent=1) + "\n")
        report[beat["id"]] = {"seconds": round(seconds, 2), "words": len(words)}
        print(f"{beat['id']}: {seconds:.2f}s, {len(words)} words, window {beat['window']}")

    if not only:
        (OUT / "durations-v4.json").write_text(json.dumps(report, indent=1) + "\n")


if __name__ == "__main__":
    main()
