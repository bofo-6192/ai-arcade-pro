"""
NeuroPlay Arcade - Full Sound + Background Music Generator

This script generates all game sound effects and looping background music
as WAV files so the whole project stays self-contained and offline.

Generated files:
- assets/sounds/click.wav
- assets/sounds/pop.wav
- assets/sounds/drop.wav
- assets/sounds/line.wav
- assets/sounds/win.wav
- assets/sounds/lose.wav
- assets/sounds/bg_music.wav
"""

from __future__ import annotations

import math
import os
import random
import struct
import wave
from typing import Iterable, List

SAMPLE_RATE = 44100
MAX_INT16 = 32767


def clamp(value: float, minimum: float = -1.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def write_wave(filename: str, samples: Iterable[float]) -> None:
    os.makedirs(os.path.dirname(filename), exist_ok=True)

    with wave.open(filename, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)

        frames = bytearray()
        for sample in samples:
            safe = clamp(sample)
            frames.extend(struct.pack("<h", int(safe * MAX_INT16)))

        wav_file.writeframes(bytes(frames))


def sine_wave(
    frequency: float,
    duration: float,
    volume: float = 0.5,
    phase: float = 0.0
) -> List[float]:
    total = int(SAMPLE_RATE * duration)
    return [
        volume * math.sin(2.0 * math.pi * frequency * (i / SAMPLE_RATE) + phase)
        for i in range(total)
    ]


def square_wave(
    frequency: float,
    duration: float,
    volume: float = 0.3
) -> List[float]:
    total = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(total):
        t = i / SAMPLE_RATE
        value = math.sin(2.0 * math.pi * frequency * t)
        samples.append(volume if value >= 0 else -volume)
    return samples


def white_noise(duration: float, volume: float = 0.2) -> List[float]:
    total = int(SAMPLE_RATE * duration)
    return [volume * (random.random() * 2.0 - 1.0) for _ in range(total)]


def silence(duration: float) -> List[float]:
    return [0.0] * int(SAMPLE_RATE * duration)


def apply_fade(
    samples: List[float],
    fade_in: float = 0.01,
    fade_out: float = 0.03
) -> List[float]:
    total = len(samples)
    fade_in_samples = int(SAMPLE_RATE * fade_in)
    fade_out_samples = int(SAMPLE_RATE * fade_out)

    for i in range(total):
        gain = 1.0

        if fade_in_samples > 0 and i < fade_in_samples:
            gain *= i / fade_in_samples

        if fade_out_samples > 0 and i >= total - fade_out_samples:
            gain *= max(0.0, (total - i - 1) / fade_out_samples)

        samples[i] *= gain

    return samples


def normalize(samples: List[float], peak: float = 0.92) -> List[float]:
    if not samples:
        return samples

    max_value = max(abs(s) for s in samples)
    if max_value == 0:
        return samples

    scale = peak / max_value
    return [s * scale for s in samples]


def mix(*tracks: List[float]) -> List[float]:
    if not tracks:
        return []

    length = max(len(track) for track in tracks)
    result = [0.0] * length

    for track in tracks:
        for i, value in enumerate(track):
            result[i] += value

    return result


def concat(*tracks: List[float]) -> List[float]:
    output: List[float] = []
    for track in tracks:
        output.extend(track)
    return output


def pitch_sweep(
    start_freq: float,
    end_freq: float,
    duration: float,
    volume: float = 0.4
) -> List[float]:
    total = int(SAMPLE_RATE * duration)
    samples = []
    phase = 0.0

    for i in range(total):
        progress = i / max(1, total - 1)
        freq = start_freq + (end_freq - start_freq) * progress
        phase += 2.0 * math.pi * freq / SAMPLE_RATE
        samples.append(volume * math.sin(phase))

    return samples


def add_echo(
    samples: List[float],
    delay: float = 0.18,
    decay: float = 0.35
) -> List[float]:
    delay_samples = int(SAMPLE_RATE * delay)
    result = samples[:]

    if delay_samples <= 0:
        return result

    if len(result) < len(samples) + delay_samples:
        result.extend([0.0] * delay_samples)

    for i, sample in enumerate(samples):
        if i + delay_samples < len(result):
            result[i + delay_samples] += sample * decay

    return result


def soft_envelope(samples: List[float]) -> List[float]:
    total = len(samples)
    if total == 0:
        return samples

    shaped = []
    for i, value in enumerate(samples):
        x = i / total
        env = 0.75 + 0.25 * math.sin(math.pi * x)
        shaped.append(value * env)
    return shaped


# =========================================================
# SOUND EFFECTS
# =========================================================

def create_click() -> List[float]:
    tone1 = sine_wave(1100, 0.03, 0.36)
    tone2 = sine_wave(1500, 0.02, 0.18)
    return normalize(apply_fade(mix(tone1, tone2), 0.002, 0.02))


def create_pop() -> List[float]:
    body = pitch_sweep(700, 220, 0.08, 0.42)
    burst = white_noise(0.04, 0.10)
    return normalize(apply_fade(mix(body, burst), 0.002, 0.05))


def create_drop() -> List[float]:
    low = pitch_sweep(260, 160, 0.14, 0.52)
    thump = sine_wave(120, 0.08, 0.18)
    return normalize(apply_fade(mix(low, thump), 0.002, 0.08))


def create_line() -> List[float]:
    layer1 = sine_wave(520, 0.09, 0.25)
    layer2 = sine_wave(860, 0.09, 0.20)
    layer3 = square_wave(260, 0.08, 0.07)
    return normalize(apply_fade(mix(layer1, layer2, layer3), 0.002, 0.05))


def create_win() -> List[float]:
    notes = [523.25, 659.25, 783.99, 1046.50]
    parts = []
    for note in notes:
        parts.append(apply_fade(sine_wave(note, 0.12, 0.30), 0.005, 0.04))
        parts.append(silence(0.015))
    return normalize(add_echo(concat(*parts), delay=0.14, decay=0.22))


def create_lose() -> List[float]:
    notes = [700.0, 520.0, 330.0, 220.0]
    parts = []
    for note in notes:
        parts.append(apply_fade(sine_wave(note, 0.11, 0.26), 0.005, 0.05))
        parts.append(silence(0.01))
    return normalize(add_echo(concat(*parts), delay=0.12, decay=0.18))


# =========================================================
# BACKGROUND MUSIC
# =========================================================

def note_frequency(note: str) -> float:
    notes = {
        "C4": 261.63,
        "D4": 293.66,
        "E4": 329.63,
        "F4": 349.23,
        "G4": 392.00,
        "A4": 440.00,
        "B4": 493.88,
        "C5": 523.25,
        "D5": 587.33,
        "E5": 659.25,
        "G3": 196.00,
        "A3": 220.00,
        "B3": 246.94,
        "E3": 164.81,
        "F3": 174.61,
        "C3": 130.81,
        "D3": 146.83,
    }
    return notes[note]


def create_note(note: str, duration: float, volume: float = 0.15) -> List[float]:
    freq = note_frequency(note)
    base = sine_wave(freq, duration, volume)
    harmonic = sine_wave(freq * 2, duration, volume * 0.22)
    soft = sine_wave(freq * 0.5, duration, volume * 0.08)
    mixed = mix(base, harmonic, soft)
    shaped = apply_fade(mixed, 0.01, min(0.08, duration / 2))
    return soft_envelope(shaped)


def create_chord(notes: List[str], duration: float, volume: float = 0.10) -> List[float]:
    layers = [create_note(note, duration, volume) for note in notes]
    return normalize(mix(*layers), peak=0.55)


def repeat_track(track: List[float], times: int) -> List[float]:
    result: List[float] = []
    for _ in range(times):
        result.extend(track)
    return result


def create_background_music() -> List[float]:
    """
    Creates calm arcade-style background music.
    Length is around 40 seconds and can be looped in JS.
    """

    progression = [
        ["C4", "E4", "G4"],
        ["A3", "C4", "E4"],
        ["F3", "A3", "C4"],
        ["G3", "B3", "D4"],
    ]

    melody_sequence = [
        ("E4", 0.35), ("G4", 0.35), ("C5", 0.55), ("G4", 0.35),
        ("E4", 0.35), ("D4", 0.35), ("E4", 0.55), ("G4", 0.35),

        ("A4", 0.35), ("C5", 0.35), ("E5", 0.55), ("C5", 0.35),
        ("A4", 0.35), ("G4", 0.35), ("E4", 0.55), ("D4", 0.35),

        ("F4", 0.35), ("A4", 0.35), ("C5", 0.55), ("A4", 0.35),
        ("F4", 0.35), ("E4", 0.35), ("D4", 0.55), ("C4", 0.35),

        ("G4", 0.35), ("B4", 0.35), ("D5", 0.55), ("B4", 0.35),
        ("G4", 0.35), ("E4", 0.35), ("D4", 0.55), ("G4", 0.35),
    ]

    chord_duration = 2.8
    melody_note_gap = 0.03

    harmony_parts = []
    for chord in progression:
        harmony_parts.append(create_chord(chord, chord_duration, volume=0.09))
    harmony_loop = concat(*harmony_parts)

    bass_line = []
    bass_notes = ["C3", "A3", "F3", "G3"]
    for bass in bass_notes:
        bass_line.append(create_note(bass, 0.7, volume=0.08))
        bass_line.append(create_note(bass, 0.7, volume=0.06))
        bass_line.append(create_note(bass, 0.7, volume=0.08))
        bass_line.append(create_note(bass, 0.7, volume=0.06))
    bass_loop = concat(*bass_line)

    melody_parts = []
    for note, duration in melody_sequence:
        melody_parts.append(create_note(note, duration, volume=0.13))
        melody_parts.append(silence(melody_note_gap))
    melody_loop = concat(*melody_parts)

    percussion = []
    for i in range(int(len(harmony_loop) / (SAMPLE_RATE * 0.35))):
        click = create_click()
        quiet_click = [s * 0.22 for s in click]
        percussion.append(quiet_click)
        percussion.append(silence(0.35))
    percussion_loop = concat(*percussion)

    section = mix(harmony_loop, bass_loop, melody_loop, percussion_loop)
    section = add_echo(section, delay=0.22, decay=0.16)
    section = normalize(section, peak=0.5)

    full_track = repeat_track(section, 2)
    full_track = apply_fade(full_track, fade_in=1.2, fade_out=1.8)
    return normalize(full_track, peak=0.55)


def main() -> None:
    output_dir = os.path.join("assets", "sounds")
    os.makedirs(output_dir, exist_ok=True)

    sound_map = {
        "click.wav": create_click(),
        "pop.wav": create_pop(),
        "drop.wav": create_drop(),
        "line.wav": create_line(),
        "win.wav": create_win(),
        "lose.wav": create_lose(),
        "bg_music.wav": create_background_music(),
    }

    for filename, samples in sound_map.items():
        write_wave(os.path.join(output_dir, filename), samples)

    print("All sound files generated successfully in assets/sounds/")


if __name__ == "__main__":
    main()