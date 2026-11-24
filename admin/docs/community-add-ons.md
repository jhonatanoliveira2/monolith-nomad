# Community add-ons

Third-party ZIM packages that extend the Information Library. They are not maintained by this project: bugs and requests go to each add-on's repository. To suggest one, [open an issue](https://github.com/jhonatanoliveira2/monolith-nomad/issues/new).

| Add-on | Content | Final ZIM | Downloaded while building |
|---|---|---|---|
| [US military field manuals](https://github.com/jrsphoto/ZIM-military-field-manuals) | ~180 manuals in English (field medicine, survival, map reading) | ~2 GB | ~2 GB from archive.org |
| [W3Schools offline](https://github.com/kennethbrewer3/ZIM-w3schools-offline) | HTML, CSS, JavaScript, Python and SQL tutorials in English | ~700 MB | ~6 GB |

## Installing

1. Clone the add-on's repository on the server (SSH).
2. Install the dependencies from its README (usually `git`, `python3`, `unzip`, `zim-tools`).
3. Run `install.sh --deploy` with the library folder (`/opt/project-nomad/storage/zim`) and the Kiwix container (`nomad_kiwix_server`).
4. The script builds the ZIM, registers it in Kiwix and restarts the container.

Building can take from minutes to over an hour. If Kiwix does not pick up the ZIM, [open an issue here](https://github.com/jhonatanoliveira2/monolith-nomad/issues).
