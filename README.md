# lucibear-userscripts

Collection of user scripts. Each top-level subfolder contains a single userscript or a small related set of scripts.

Repository layout


How to use


Index of scripts

- `youtube-fullerscreen/` — Re-enable YouTube fullscreen scroll feature. This script removes the `deprecate-fullerscreen-ui` attribute so the browser's fullscreen-scroll-to-seek behaviour is restored on watch pages. Note: YouTube has marked this feature as deprecated; if the platform moves it from deprecated to disabled the userscript may stop working or could break the behavior.

How to use

- Install a userscript manager (Tampermonkey, Violentmonkey, etc) and add the `.user.js` file from the desired subfolder.
- Keep each script inside its own folder with a short `README.md` and the script file(s).

Contributing

- Open issues or PRs on the GitHub repo for bug reports, compatibility fixes, or new scripts.

License

- (Add license file if you want this repo to be open-source)
