#!/usr/bin/env python3
"""Tests for picking which model files to download.

Pure functions only, no Bergamot and no network, so this runs anywhere:

    python3 install/nomad-translate/test_fetch_models.py

The records below copy the shapes Firefox Remote Settings actually returned.
The first case is the one that broke: a pre-release version string ("1.0a1")
crashed the fetch, so Swedish and 21 other languages never downloaded.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import fetch_models  # noqa: E402

failures: list[str] = []

NIGHTLY = "env.channel == 'default' || env.channel == 'nightly'"
DESKTOP = "env.appinfo.OS != 'Android' || env.channel != 'release'"
ANDROID = "env.appinfo.OS == 'Android' "


def check(name: str, got, want):
    if got != want:
        failures.append(f"{name}\n    expected: {want!r}\n    got:      {got!r}")


def record(src, dst, kind, version, filter_expression=""):
    return {
        "fromLang": src,
        "toLang": dst,
        "fileType": kind,
        "version": version,
        "filter_expression": filter_expression,
        "name": f"{kind}.{src}{dst}",
    }


def pair(src, dst, version, filter_expression="", kinds=("model", "lex", "vocab")):
    return [record(src, dst, kind, version, filter_expression) for kind in kinds]


def chosen_versions(data, src, dst):
    files = fetch_models.choose_files(data, src, dst)
    if files is None:
        return None
    return {kind: r["version"] for kind, r in files.items()}


# --- versions ------------------------------------------------------------------

check("release: plain version", fetch_models.release_version(record("en", "sv", "model", "1.0")), (1, 0))
check("release: desktop filter", fetch_models.release_version(record("en", "ja", "model", "2.1", DESKTOP)), (2, 1))
check("release: missing filter", fetch_models.release_version({"version": "2.0", "filter_expression": None}), (2, 0))
check("skip: pre-release", fetch_models.release_version(record("en", "sv", "model", "1.0a1")), None)
check("skip: nightly only", fetch_models.release_version(record("en", "sv", "model", "1.0", NIGHTLY)), None)
check("skip: android only", fetch_models.release_version(record("en", "ja", "model", "2.2", ANDROID)), None)
check("compare: 2.10 beats 2.9", (2, 10) > fetch_models.release_version(record("en", "x", "model", "2.9")), True)

# --- choosing a pair -----------------------------------------------------------

# Swedish as published: a release and a nightly-only pre-release side by side.
SWEDISH = pair("en", "sv", "1.0") + pair("en", "sv", "1.0a1", NIGHTLY)
check("sv: pre-release ignored, release kept", chosen_versions(SWEDISH, "en", "sv"),
      {"model": "1.0", "lex": "1.0", "vocab": "1.0"})

# Newest complete release wins.
FRENCH = pair("en", "fr", "1.0") + pair("en", "fr", "2.0")
check("fr: newest release", chosen_versions(FRENCH, "en", "fr"),
      {"model": "2.0", "lex": "2.0", "vocab": "2.0"})

# A newer version missing a file must not be mixed with an older one.
PARTIAL = pair("en", "xx", "1.0") + pair("en", "xx", "2.0", kinds=("model", "lex"))
check("incomplete newer version: falls back whole", chosen_versions(PARTIAL, "en", "xx"),
      {"model": "1.0", "lex": "1.0", "vocab": "1.0"})

# Japanese publishes separate source and target vocabs, and an Android build.
JAPANESE = (
    pair("en", "ja", "2.1", DESKTOP, kinds=("model", "lex", "srcvocab", "trgvocab"))
    + pair("en", "ja", "2.2", ANDROID, kinds=("model", "lex", "srcvocab", "trgvocab"))
    + pair("en", "ja", "2.3", kinds=("model", "lex", "srcvocab", "trgvocab"))
)
check("ja: split vocab, android skipped", chosen_versions(JAPANESE, "en", "ja"),
      {"model": "2.3", "lex": "2.3", "srcvocab": "2.3", "trgvocab": "2.3"})

# Only pre-releases published: nothing to fetch, and no crash.
check("only pre-releases: none", chosen_versions(pair("en", "nn", "1.0a1", NIGHTLY), "en", "nn"), None)
check("other direction ignored", chosen_versions(SWEDISH, "sv", "en"), None)

# --- verified downloads (SHA-256 from Remote Settings, retry with backoff) ---
import hashlib  # noqa: E402
import io  # noqa: E402
import tempfile  # noqa: E402

GOOD = b"model-bytes" * 1000
GOOD_SHA = hashlib.sha256(GOOD).hexdigest()


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def opener_from(*bodies):
    """Each call returns the next body; an Exception instance is raised instead."""
    calls = []

    def opener(url, timeout=None):
        body = bodies[len(calls)]
        calls.append(url)
        if isinstance(body, Exception):
            raise body
        return FakeResponse(body)

    return opener, calls


with tempfile.TemporaryDirectory() as tmp:
    dest = Path(tmp) / "model.enpt.bin"
    opener, calls = opener_from(GOOD)
    fetch_models.download_verified("u", dest, len(GOOD), GOOD_SHA, opener=opener, sleep=lambda s: None)
    check("verified download: installed", dest.read_bytes() == GOOD, True)
    check("verified download: no .part left", (Path(tmp) / "model.enpt.bin.part").exists(), False)

with tempfile.TemporaryDirectory() as tmp:
    dest = Path(tmp) / "lex.enpt.bin"
    corrupt = GOOD[:-1] + b"X"
    opener, calls = opener_from(OSError("connection reset"), corrupt, GOOD)
    slept = []
    fetch_models.download_verified("u", dest, len(GOOD), GOOD_SHA, opener=opener, sleep=slept.append)
    check("retry: network error then bad hash then good", (len(calls), dest.read_bytes() == GOOD), (3, True))
    check("retry: two backoff waits", len(slept), 2)

with tempfile.TemporaryDirectory() as tmp:
    dest = Path(tmp) / "vocab.enpt.spm"
    opener, calls = opener_from(*([GOOD[:-10]] * fetch_models.ATTEMPTS))
    try:
        fetch_models.download_verified("u", dest, len(GOOD), GOOD_SHA, opener=opener, sleep=lambda s: None)
        outcome = "installed"
    except RuntimeError:
        outcome = "raised"
    check("always short: gives up, nothing installed", (outcome, dest.exists(), len(calls)),
          ("raised", False, fetch_models.ATTEMPTS))

check("backoff: full jitter within the exponential cap",
      [fetch_models.backoff_delay(n, rand=lambda: 1.0) for n in (1, 2, 3, 4, 5, 6)], [2.0, 4.0, 8.0, 16.0, 30.0, 30.0])
check("backoff: jitter can be zero", fetch_models.backoff_delay(3, rand=lambda: 0.0), 0.0)
check("default languages start with Portuguese", fetch_models.DEFAULT_LANGS.split(",")[0], "pt")

if failures:
    print(f"FAIL: {len(failures)} of the checks above did not hold\n")
    for failure in failures:
        print(f"  {failure}\n")
    sys.exit(1)

print("ok: all model selection checks passed")
