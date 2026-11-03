"""Regenerate the small synthetic narration fixture using ffmpeg."""
import subprocess
from pathlib import Path

subprocess.run([
    "ffmpeg", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=16000:duration=20",
    "-ac", "1", "-b:a", "24k", "-map_metadata", "-1", "-y",
    str(Path(__file__).resolve().parents[1] / "cypress/fixtures/narration.mp3"),
], check=True)
