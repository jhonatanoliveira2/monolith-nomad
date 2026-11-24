# Supply Depot apps

Each app runs in its own container on your server and gets an **Open** button once installed. This page only covers what is specific here: login, first credentials, where data lives and what works offline.

## Managing

Each card's **Manage** menu has:

- **Documentation**: the app's section on this page.
- **Edit**: ports, volumes, environment variables, memory and CPU limits, and a custom open URL (reverse proxy, local DNS). Tweaks such as GPU access are kept.
- **Logs** and **Stats**: live output and usage.
- **Update** and **Remove**: if the new container does not start, the app rolls back.

The card shows the installed version and an orange badge when an update is available. Automatic updates: [Updates guide](/docs/updates).

## Custom app

**Add a custom app** runs any Docker image (e.g. `ghcr.io/owner/app:1.2.3`) with ports, volumes, variables and limits. The preflight warns about port conflicts and risky settings; soft warnings (a `:latest` tag, an unknown registry) can be overridden, unsafe settings are blocked. Software outside the catalog is not supported.

---

## Stirling PDF {% #stirling-pdf %}

50+ PDF tools: merge, split, convert, compress, OCR, sign, redact. [Website](https://stirlingpdf.com) · [Source](https://github.com/Stirling-Tools/Stirling-PDF)

- **Access:** opens without login ("Guest" shows). Takes 30 to 60 s to start and uses ~1 GB of RAM.
- **Turn login on:** **Manage › Edit**, change `SECURITY_ENABLELOGIN=false` to `true`. First login: `admin` / `stirling`, then set a new password.
- **Files:** works with files from your device ("Open from computer"), not the server's. Settings in `storage/stirling-pdf`.
- **Offline:** yes. OCR ships with English; other languages need the internet.

## File Browser {% #file-browser %}

A web file manager for the server. [Website](https://filebrowser.org) · [Source](https://github.com/filebrowser/filebrowser)

- **Access:** `admin` / `nomad`. **Change the password right away**: it is the same on every install (gear › profile).
- **Folders:** `books`, `maps`, `media`, `zim`, `kb_uploads`. App-internal folders are hidden on purpose.
- **Careful:** there is no trash; deleted files are gone.
- **Offline:** yes.

## Calibre-Web {% #calibre-web %}

An e-book reader and organiser. [Source](https://github.com/janeczku/calibre-web)

- **First run:** in **Database Configuration**, enter `/books` and click **Save**.
- **Login:** `admin` / `admin123`. **Change the password** (`admin` › Edit).
- **Adding books:** enable uploads in **Admin**, or drop files into `books` with File Browser and use "scan".
- **Data:** the `books` folder. **Offline:** yes, except "fetch metadata".

## IT Tools {% #it-tools %}

100+ utilities: hashes, base64, JSON, UUID, QR codes, colours. [Website](https://it-tools.tech) · [Source](https://github.com/CorentinTh/it-tools)

- No login, nothing stored. **Offline:** yes.

## Excalidraw {% #excalidraw %}

A hand-drawn style whiteboard for diagrams. [Website](https://excalidraw.com) · [Source](https://github.com/excalidraw/excalidraw)

- **No server storage:** drawings live in the browser and do not follow you to other devices; clearing browser data deletes them. Use **Save to...** for an `.excalidraw` file.
- **Offline:** yes, but without the internet the handwritten font falls back to a plain one.
- Online, it sends anonymous page-view stats (Simple Analytics). "Live collaboration", "Excalidraw+" and "Library" need the cloud.

## Homebox {% #homebox %}

Home inventory: locations, labels, photos, warranties, receipts. [Website](https://homebox.software) · [Source](https://github.com/sysadminsmedia/homebox)

- **First run:** **Register** with an e-mail, name and strong password. The first account is the owner.
- **Block new sign-ups:** **Manage › Edit**, add `HBOX_OPTIONS_ALLOW_REGISTRATION=false`.
- **Data:** `storage/homebox`. **Offline:** yes.

## Vaultwarden {% #vaultwarden %}

A password manager compatible with the Bitwarden apps and extensions. [Website](https://bitwarden.com) · [Source](https://github.com/dani-garcia/vaultwarden)

- **Certificate warning:** expected (HTTPS with a self-signed certificate). Click **Advanced › Proceed to the address**; the browser remembers.
- **Vault:** **Create account** with an e-mail and a master password. **The master password cannot be recovered.**
- **Block new sign-ups:** add `SIGNUPS_ALLOWED=false` in **Manage › Edit**.
- **Phone and browser:** in the Bitwarden app, choose **self-hosted** and enter `https://<server>:8480`.
- **Data:** `storage/vaultwarden`. **Offline:** yes; the apps keep a local copy of the vault.

## Jellyfin {% #jellyfin %}

A media server for films, shows, music and photos. [Website](https://jellyfin.org) · [Source](https://github.com/jellyfin/jellyfin)

- **First run:** language → administrator account → libraries.
- **One folder per library:** Movies → `Movies`, Shows → `TV Shows`, Music → `Music`, Photos → `Photos`. Do not point one at the whole `media` folder, or you get "duplicate path".
- **Adding media:** upload with File Browser to `media/<type>` and run **Scan Library**. Names like `Film (2020).mp4` help find artwork.
- **Data:** media in `storage/media`, settings in `storage/jellyfin`.
- **Offline:** yes, without artwork and plots until online. No GPU video acceleration: prefer MP4/H.264.

## Meshtastic Web {% #meshtastic-web %}

A dashboard for [Meshtastic](https://meshtastic.org) radios (LoRa mesh messaging, no cell or internet). [Source](https://github.com/meshtastic/web)

- **Needs a Meshtastic radio.**
- **Connection:** use **HTTP**, with the radio on the same Wi-Fi. Bluetooth and Serial need HTTPS and do not work here; pair with the official app instead.
- **Data:** on the radio and in the browser. **Offline:** yes.

## Education Platform (Kolibri) {% #kolibri %}

Courses with videos, exercises, classes and per-learner progress. [Website](https://learningequality.org/kolibri) · [Source](https://github.com/learningequality/kolibri)

- **First run:** setup wizard and administrator account.
- **Content:** **Device → Channels → Import** (Kolibri Studio, local disk or another device).
- **Migrating from Gen 1** (`treehouses/kolibri:0.12.8`, port 8300): install Gen 2, go to **Device › Channels › Import › Local network or internet › Add new device**, enter `http://<server>:8300`, import the channels, then remove Gen 1 (the **legacy** badge). Learner data is not migrated.
- **Data:** `storage/kolibri-gen2`. **Offline:** yes, once channels are imported.

## MeshCore Web {% #meshcore-web %}

A client for [MeshCore](https://meshcore.io) radios. [Source](https://github.com/aXistem-dev/meshcore-web)

- **Needs a MeshCore radio**, connected by USB or Bluetooth **to the computer you are using**.
- **Certificate warning:** expected (self-signed HTTPS, required for USB and Bluetooth). **Advanced › Proceed to the address**.
- Use **Chrome or Edge**. **Offline:** yes.

## Translated Library {% #offline-translation %}

Translates Information Library articles: a **Translate this page** bar at the top, one button per language plus **Original**. About 1,600 times faster than the AI Assistant and no GPU needed.

- **Languages:** default `TRANSLATE_LANGS=fr,es,de`. To change, **Manage › Edit** and edit the list (e.g. `fr,es,de,sv`). Each language takes 45 to 140 MB and downloading it needs the internet.
- **Available:** Afrikaans (`af`), Arabic (`ar`), Basque (`eu`), Bengali (`bn`), Bosnian (`bs`), Bulgarian (`bg`), Catalan (`ca`), Croatian (`hr`), Czech (`cs`), Danish (`da`), Dutch (`nl`), Estonian (`et`), Finnish (`fi`), French (`fr`), Galician (`gl`), German (`de`), Greek (`el`), Gujarati (`gu`), Hebrew (`he`), Hindi (`hi`), Hungarian (`hu`), Icelandic (`is`), Indonesian (`id`), Italian (`it`), Japanese (`ja`), Kannada (`kn`), Korean (`ko`), Latvian (`lv`), Lithuanian (`lt`), Malay (`ms`), Malayalam (`ml`), Marathi (`mr`), Norwegian (`nb`), Persian (`fa`), Polish (`pl`), Portuguese (`pt`), Romanian (`ro`), Russian (`ru`), Serbian (`sr`), Slovak (`sk`), Slovenian (`sl`), Spanish (`es`), Swedish (`sv`), Tamil (`ta`), Telugu (`te`), Thai (`th`), Turkish (`tr`), Ukrainian (`uk`), Urdu (`ur`), Vietnamese (`vi`). Chinese is not available yet.
- **Not translated:** tables, the tab title and Kiwix's own search results (search in the original language).
- **Accuracy:** literal machine translation; be careful with exact medical and safety terms.
- **Data:** `storage/translate/models`. **Offline:** yes, once the models are downloaded.
