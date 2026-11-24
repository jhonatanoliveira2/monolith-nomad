# Updates

Three things update independently:

| Type | What it is | Where it comes from |
|---|---|---|
| **Software** | The Command Center | Releases of this repository and `ghcr.io/jhonatanoliveira2` |
| **Apps** | Kiwix, Ollama, Kolibri and the rest of the [Supply Depot](/supply-depot) | Each author's image registry |
| **Content** | ZIMs, maps and the Drug Reference | Kiwix and map catalogs, SHA-256 checked |

## Manual

- **Software:** [Updates](/settings/update). Takes 2 to 5 minutes; if it fails, the previous version stays up.
- **Apps:** **Manage › Update** on the app card. If the new container does not start, the app rolls back.
- **Content:** [Content Manager](/settings/zim) and [Explorer](/settings/zim/remote-explorer).

## Automatic

Opt-in and **off by default**, in [Updates](/settings/update).

- They only run inside the **time window** you set.
- **Major versions are never automatic**, only minor and patch releases.
- First they check disk space and that no other download or install is running.
- Offline, the run is skipped.
- **Software:** waits a configurable period after each release and turns itself off after repeated failures.
- **Apps:** need the global switch **and** the app's own switch in the Depot.
- **Content:** its own night window with a bandwidth cap; the Knowledge Base follows Wikipedia replacements.

## Early Access

In [Updates](/settings/update), the Early Access channel installs release candidates. You can return to the stable channel at any time.

**[Check for updates →](/settings/update)** · **[Release Notes →](/docs/release-notes)**
