# lucibear-userscripts

Collection of user scripts. Each top-level subfolder contains a single userscript
or a small related set of scripts.

Repository layout

Index of scripts

-   `youtube-fullerscreen/` — Re-enable YouTube fullscreen scroll feature.  
    This
    script removes the `deprecate-fullerscreen-ui` attribute so the browser's
    fullscreen scroll-to-seek behaviour is restored on watch pages.  
    Note: YouTube has marked this feature as deprecated; if YouTube disables it the
    userscript may stop working.  
    [Install here](/youtube-fullerscreen/youtube-fullerscreen.user.js)

How to use

-   Install a userscript manager (Tampermonkey, Violentmonkey, etc) and add the
    `.user.js` file from the desired subfolder.
-   Keep each script inside its own folder with a short `README.md` and the
    script file(s).

Contributing

-   Open issues or pull requests on the GitHub repository for bugs,
    compatibility fixes, or new scripts.

License

-   This repository is licensed under the MIT License — see the `LICENSE` file.
