#!/usr/bin/env python3
"""Generate the WickSight 60 s voiceover with ElevenLabs.

The API key is never printed and is read from ELEVENLABS_API_KEY or
--env-file (default: the owner's local Kota Kita TTS env).
"""
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
VIDEO = HERE.parent
OUT = VIDEO / "public" / "vo"
LINES = VIDEO / "vo" / "lines.json"
DEFAULT_ENV = VIDEO / "vo" / ".env"


def api_key(env_file: Path) -> str:
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not key and env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("ELEVENLABS_API_KEY="):
                key = line.split("=", 1)[1].strip()
                break
    if not key.startswith("sk_"):
        sys.exit("ELEVENLABS_API_KEY tidak ditemukan (harus diawali sk_).")
    return key


def tts(key: str, voice_id: str, model_id: str, settings: dict, text: str, out: Path) -> None:
    body = {
        "text": text,
        "model_id": model_id,
        "voice_settings": settings,
    }
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128",
        data=json.dumps(body).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                out.write_bytes(r.read())
            return
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:400]
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(3 * (attempt + 1))
                continue
            sys.exit(f"ElevenLabs error {e.code}: {msg}")
        except urllib.error.URLError as e:
            if attempt < 3:
                time.sleep(3 * (attempt + 1))
                continue
            sys.exit(f"ElevenLabs network error: {e}")


def duration(path: Path) -> float:
    return float(
        subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]
        )
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--env-file", type=Path, default=DEFAULT_ENV)
    ap.add_argument("--voice", default="onwK4e9ZLuTAKqWW03F9")
    ap.add_argument("--model", default="eleven_v3")
    ap.add_argument("--stability", type=float, default=0.5)
    ap.add_argument("--similarity", type=float, default=0.75)
    ap.add_argument("--style", type=float, default=0.3)
    ap.add_argument("--speed", type=float, default=0.0, help="0 = model default; only multilingual_v2 supports it")
    ap.add_argument("--only", default="", help="comma-separated beat ids")
    ap.add_argument("--lines", type=Path, default=LINES)
    ap.add_argument("--report", type=Path, default=OUT / "durations.json")
    args = ap.parse_args()

    spec = json.loads(args.lines.read_text())
    key = api_key(args.env_file)
    OUT.mkdir(parents=True, exist_ok=True)
    only = {s.strip() for s in args.only.split(",") if s.strip()}

    settings = {"stability": args.stability, "similarity_boost": args.similarity, "style": args.style}
    if args.speed:
        settings["speed"] = args.speed

    report = {}
    for beat in spec["beats"]:
        if only and beat["id"] not in only:
            continue
        raw = OUT / f"{beat['id']}-raw.mp3"
        dst = OUT / f"{beat['id']}.mp3"
        tts(key, args.voice, args.model, settings, beat["text"], raw)
        # Trim leading/trailing silence, normalise voice to a consistent bed.
        af = (
            "silenceremove=start_periods=1:start_threshold=-45dB,"
            "areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
        )
        if beat.get("atempo"):
            af += f",atempo={beat['atempo']}"
        af += ",loudnorm=I=-16:TP=-1.5:LRA=7"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", af, "-ar", "44100", "-b:a", "160k", str(dst)],
            check=True,
        )
        raw.unlink(missing_ok=True)
        d = duration(dst)
        words = len(beat["text"].split())
        report[beat["id"]] = {"seconds": round(d, 2), "words": words, "wpm": round(words / d * 60, 1)}
        print(f"{beat['id']}: {d:.2f}s, {words} words, {words / d * 60:.0f} wpm")

    args.report.write_text(json.dumps(report, indent=1) + "\n")


if __name__ == "__main__":
    main()
