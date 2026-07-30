# Naruto Rebuild RD Library

A multi-user Stremio companion addon for the custom `NR...` IDs used by the Rebuild of Naruto catalog. Each user enters their own Real-Debrid token. The addon searches only completed torrents already stored in that user's Real-Debrid library.

Keep the original Rebuild Anime addon installed because it supplies the catalog and episode metadata.

## Run locally on Windows

Requires Node.js 18 or newer.

```powershell
cd C:\Users\Alex\Desktop\naruto-rebuild-rd-addon\naruto-rebuild-rd
$env:CONFIG_SECRET=[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
npm test
npm start
```

Open `http://127.0.0.1:7000/configure`.

Press `Ctrl+C` to stop the server. After changing code, start it again with `npm start`. For automatic restarts while editing, use `npm run dev`.

## Deploy publicly on Vercel

1. Put the contents of this project folder in a GitHub repository.
2. Import that repository into Vercel.
3. In Vercel project settings, add an environment variable named `CONFIG_SECRET` with one long random value.
4. Deploy.
5. Share `https://YOUR-PROJECT.vercel.app/configure`.

Do not set a global `RD_TOKEN`. Every user supplies their own token on the configuration page.

Changing `CONFIG_SECRET` invalidates all existing personalized addon URLs. Those URLs are sensitive because possessing one allows requests through the associated Real-Debrid account.

## How it works

- `/configure` validates the user's RD token.
- The token is encrypted with AES-256-GCM into a personalized URL; it is not stored in a database.
- `/<encrypted-config>/manifest.json` is installed in Stremio.
- Stream requests look up the Rebuild episode title, scan downloaded RD torrents, choose the closest selected video file, and call RD's unrestrict endpoint.

## Useful endpoints

- `/configure` — setup page
- `/health` — deployment health check
- `/<config>/manifest.json` — personalized manifest

## Environment variables

- `CONFIG_SECRET` — required
- `CACHE_MINUTES` — RD library cache duration, default 10
- `RD_MAX_PAGES` — maximum 100-item RD torrent pages, default 25
- `RD_CONCURRENCY` — parallel torrent-info requests, default 5
- `REBUILD_META_URL` — optional metadata endpoint override
