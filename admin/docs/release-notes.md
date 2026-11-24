# Release Notes

Issues and suggestions: [GitHub Issues](https://github.com/jhonatanoliveira2/monolith-nomad/issues).

## Version 1.2.0 - November 24, 2026

### Interface
- **Nothing redesign:** a single navigation grouped by Knowledge, Content, Apps, System and Help; a command palette (**Ctrl K**); a dashboard with system status and downloads; and a **[Downloads](/downloads)** screen with every queue in one place.
- **Dotted Ubuntu logo**, with Ubuntu orange as the accent colour.
- **Library:** filters by area, subject, level, format, language and availability; a details drawer; a built-in PDF reader (search, outline, zoom, dark pages) and an EPUB reader with search and themes.

### Easy Setup
- Four steps (**Features, Maps, Content, Review**) with a summary panel, the total download and the free space left after installing.
- **Brazil by default:** pt-BR, America/Sao_Paulo, a selectable state and time zone (all four Brazilian zones), Brazilian formats.
- **Brazilian maps:** the whole country, regions or states (27 units), sized at the source.
- **Essential, Standard and Comprehensive profiles** per area, or a custom pick. Portuguese content by default; English opt-in per area or item.
- Choices saved on the server; items already installed or downloading are never queued twice.

### Installer
- America/Sao_Paulo when the host runs on UTC, `NOMAD_TZ` to pick another zone, and the pt_BR.UTF-8 locale.

### Documentation
- In-app documentation rewritten: shorter and matching the new interface.

## Version 1.1.0 - November 21, 2026

- **Portuguese catalog:** Portuguese Wikipedia is the default; Portuguese and multilingual ZIMs come first in each area, and every package shows its language.
- **Library:** 37 openly licensed works (PDF, EPUB and ZIM) by area, subject and level, with pinned SHA-256 and an offline reader.
- **AMD GPUs:** the real model and VRAM are reported (previously "Device 7590" with 512 MB).

## Version 1.0.0 - November 20, 2026

- **Smart downloads:** official Kiwix mirrors benchmarked before downloading, aria2c with resume, SHA-256 checked before anything is installed.
- **Own distribution:** installer, images, updates and catalogs come from this repository; third-party online services off by default.
- **Nothing theme** and **pt-BR** as the default language.
