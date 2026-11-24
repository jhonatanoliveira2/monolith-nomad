# Frequently Asked Questions

## General

### Do I need the internet?
Only to install, download content and update. After that, everything works offline.

### Which operating system?
**Ubuntu 26.04 LTS** (recommended), Ubuntu 24.04 LTS or Debian 12. Requirements and installation: [Getting started](/docs/getting-started).

### How much RAM?
- **Without AI:** the whole stack uses under 1 GB (Command Center 241 MB, MySQL 444 MB, Kiwix 101 MB, Redis 9 MB, index 155 MB). 4 GB is enough.
- **With AI:** idle Ollama uses ~1.2 GB, and a model takes about its download size (an 8B needs ~4.6 GB). 8 GB for a small model, 16 GB comfortable, 32 GB for larger models.
- With a dedicated GPU the model sits in VRAM; without one it uses system RAM.

### How much disk?
~5 GB for the system (keep 10 GB free), ~25 GB with the AI. Content comes on top: full Portuguese Wikipedia ~20 GB (English ~120 GB), AI models 10 to 40 GB. [Easy Setup](/easy-setup) shows the total and the space left before downloading.

## Content

### What are the Essential, Standard and Comprehensive profiles?
Levels of each area: **Essential** is the core (smallest download), **Standard** adds complementary material and **Comprehensive** brings everything. A custom, item-by-item pick is also available.

### Why are some items off?
Portuguese (and multilingual) content is included by default. English items start off and can be enabled per area or one by one; every item shows its language.

### How do downloads work?
For Kiwix: the official mirror list, a speed test from your connection, aria2c with resume and the SHA-256 checked before installing. An incomplete or corrupt file is never installed. Everything is listed in [Downloads](/downloads), where you can cancel and retry.

### How do I add Wikipedia or other ZIMs?
[Content Explorer](/settings/zim/remote-explorer). Switching the Wikipedia edition replaces the previous one.

### Can I use my own files?
Yes: upload PDFs and text files to the [Knowledge Base](/chat?knowledge_base=true) and the AI will consult them.

### How do I add courses?
In Kolibri, as an administrator: **Device → Channels → Import**.

## AI

### How do I enable the GPU?
1. Install the driver on the host (NVIDIA: the installer handles the Container Toolkit).
2. In the [Supply Depot](/supply-depot), use **Force reinstall** on the AI Assistant.

Downloaded models are kept. With a GPU the AI is 10 to 20 times faster.

### "GPU passthrough is not working"
The host has the GPU but the container does not. Use the button to reinstall the AI Assistant.

### Does the Benchmark send results?
No. The online leaderboard is off by default; set `BENCHMARK_LEADERBOARD_URL` to turn it back on.

## Common problems

| Problem | What to do |
|---|---|
| Blank page | Wait 30 s and reload; check the service in [System](/settings/system) and restart it in the Supply Depot |
| Grey map | Download a region in the [Maps Manager](/settings/maps) and reload |
| `Failed to load the XML library file` | Stop Kiwix, wait 15 s, start it; if it persists, **Force reinstall** |
| Slow AI | Use a GPU, a smaller model or close other programs |
| Chat unavailable | Install the AI Assistant in the Supply Depot |
| Knowledge Base upload stuck | Large documents take time; check the Assistant is running |
| Download stuck | Check the connection and free space; cancel and retry in [Downloads](/downloads) |
| "Service unavailable" | Wait 1 to 2 minutes or restart the service |
| Kolibri password | An administrator resets it inside Kolibri |

## Updates

- **Software:** [Updates](/settings/update). Takes 2 to 5 minutes; if it fails, the previous version keeps running.
- **Automatic:** opt-in and off by default, inside a time window you choose, never across a major version. See [Updates](/docs/updates).
- **Content:** separate from the software, through the Content Manager or automatic content updates.

### From the command line

```bash
sudo bash /opt/project-nomad/start_nomad.sh    # start
sudo bash /opt/project-nomad/stop_nomad.sh     # stop
sudo bash /opt/project-nomad/update_nomad.sh   # update the Command Center (apps from the UI)
```

Uninstall (deletes all data):

```bash
curl -fsSL https://github.com/jhonatanoliveira2/monolith-nomad/releases/latest/download/uninstall_nomad.sh -o uninstall_nomad.sh
sudo bash uninstall_nomad.sh
```

## Privacy

- Searches, chats and documents stay on the server. The AI runs locally.
- The connectivity check only queries `1.1.1.1` and `api.github.com`.
- Anyone on your local network can reach the server. On public networks, protect access.

Found a bug? [Open an issue](https://github.com/jhonatanoliveira2/monolith-nomad/issues).
