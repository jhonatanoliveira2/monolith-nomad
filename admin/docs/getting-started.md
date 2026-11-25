# Getting started

## Requirements

| | Minimum (no AI) | Recommended (local AI) |
|---|---|---|
| **OS** | Ubuntu 24.04 LTS or Debian 12 | **Ubuntu 26.04 LTS** |
| **CPU** | 2 cores, 2 GHz | Ryzen 7 / Core i7 or better |
| **RAM** | 4 GB | 32 GB |
| **Disk** | 10 GB + content | 250 GB or more, SSD |
| **GPU** | — | 12–16 GB of VRAM (e.g. AMD RX 9060 XT 16 GB, NVIDIA RTX 3060 12 GB) |

Ubuntu Desktop or Server: everything is used from the browser. Windows (WSL2) is community-supported only; macOS, Fedora and Arch are not supported.

## Installation

```bash
sudo apt-get install -y curl && \
curl -fsSL https://github.com/jhonatanoliveira2/monolith-nomad/releases/latest/download/install_nomad.sh \
  -o install_nomad.sh && \
sudo bash install_nomad.sh
```

The installer sets up Docker, the NVIDIA Container Toolkit (with an NVIDIA GPU), the server time zone (America/Sao_Paulo when the host runs on UTC) and the pt_BR.UTF-8 locale. **The GPU driver must already be on the host**: on Ubuntu, tick "Install third-party software" while installing the OS. For another time zone: `sudo NOMAD_TZ=America/Manaus bash install_nomad.sh`.

## Easy Setup

**[Open Easy Setup →](/easy-setup)**

![Easy Setup, step 1: features](/docs/easy-setup-step1.webp)

| Step | What you choose |
|---|---|
| **1. Features** | Information Library, Education Platform, AI Assistant (with the models suggested for your GPU); state, time zone, setting (urban or rural) and city |
| **2. Maps** | All of Brazil (default), regions or states, and the level of detail |
| **3. Content** | A profile per area: **Essential**, **Standard**, **Comprehensive** or custom; **Survival library** (default: Comprehensive) |
| **4. Review** | Everything to download, the total size and the disk space left |

![Content profiles](/docs/easy-setup-tiers.webp)

- Sizes come from the catalog manifests; the map size is measured at the source for the exact selection.
- Portuguese content is included by default. English items start off and can be enabled per area or one by one.
- Anything installed or downloading is skipped; nothing is downloaded twice.
- Choices are saved: you can leave and come back.
- Nothing downloads before **Start installation**. Follow, cancel or retry in **[Downloads](/downloads)**.

## Tools

| Tool | For | Where |
|---|---|---|
| **Library** | Books and manuals in PDF, EPUB and ZIM, with a built-in reader (search, outline, dark theme, last page) | [Library](/library) |
| **Information Library** (Kiwix) | Wikipedia, medical references, how-to guides | Dashboard or [Supply Depot](/supply-depot) |
| **Education Platform** (Kolibri) | Courses with videos, exercises and per-learner progress | Dashboard or [Supply Depot](/supply-depot) |
| **AI Assistant** (Ollama) | Local chat, **Survival** mode, translation; nothing leaves the server | [Assistant](/chat) |
| **Knowledge Base** | The AI answers from your PDFs and text files | [Knowledge Base](/chat?knowledge_base=true) |
| **Maps** | Offline maps with search | [Maps](/maps) · [Manager](/settings/maps) |
| **Local assistant** | GPU, VRAM, RAM, tokens/s, AMD backend, default region | [Settings](/settings/assistant) |
| **Benchmark** | CPU, memory, disk and AI score | [Benchmark](/settings/benchmark) |

![AI Assistant](/docs/ai-chat.webp)

**GPU:** without one the AI runs on the CPU, much slower. If you add a GPU later, use **Force reinstall** on the AI Assistant in the [Supply Depot](/supply-depot).

![Knowledge Base](/docs/knowledge-base.webp)

## Local assistant (offline AI)

Once the models are downloaded, everything runs on the server with no internet: chat, embeddings, library search and translation.

| Where | What it does |
|---|---|
| **Chat → Survival** | Identifies the scenario (level 1 to 6, hazard, phase), uses your state and setting, searches the survival works first and answers with the works and pages used, keeping what is documented apart from general advice |
| **PDF and EPUB readers** | **Local assistant** button: **Ask** about the book, **Explain** the selected passage, **Summarize** the page or chapter, **Translate** only what you ask for (cached; the original file is never changed) |
| **Sources** | Each cited page opens the reader on it |

- **No real-time data:** the assistant has no weather alerts, news or civil defense warnings. In an ongoing emergency, follow the local authorities.
- **Models:** Easy Setup suggests the ones that fit your GPU. With 16 GB, `gemma4:12b` for chat and `embeddinggemma` for search.
- **AMD GPUs:** RDNA 4 cards (RX 9000) use Vulkan by default, the others ROCm; you can switch in [Local assistant](/settings/assistant).
- **Older index:** a Knowledge Base built before this version keeps its previous embedding. Use **Rebuild with EmbeddingGemma** for better search in Portuguese.

![Maps](/docs/maps.webp)

## More content

- **Survival library:** 25 official Brazilian publications (Ministry of Health, Civil Defense and Environment) on water, floods, droughts, fires, landslides, venomous animals and contingency plans, under **Survival** in the [Library](/library).
- **ZIMs and Wikipedia:** [Content Explorer](/settings/zim/remote-explorer). Only one Wikipedia edition is active at a time.
- **Maps of other countries:** [Maps Manager](/settings/maps).
- **Courses:** inside Kolibri (Device → Channels).

![Content Explorer](/docs/content-explorer.webp)

![Benchmark](/docs/benchmark.webp)

## Before going offline

1. Run the software and content [updates](/settings/update).
2. Download the maps, references, courses and AI models you will need.
3. Test each feature while you are still online, including a question in Survival mode.

Questions: [FAQ](/docs/faq) · [Issues and suggestions](https://github.com/jhonatanoliveira2/monolith-nomad/issues)
