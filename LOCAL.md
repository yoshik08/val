# val — local only

personal valorant shop checker. runs entirely on your machine, no public hosting.

## run it

**windows:** double-click `start-local.bat`
**mac/linux:** `bash start-local.sh`

then open **http://localhost:10000/val** in your browser.

## what it needs

- node.js installed ([nodejs.org](https://nodejs.org))
- that's it. no mongodb, no render, no vercel.

your ssid is encrypted and stored in `.val-local.json` next to the code.
nothing leaves your machine except the riot api calls.

## first run

1. `npm install` inside the `api/` folder (one time only)
2. run the start script
3. paste your ssid cookie from `playvalorant.com` (f12 → application → cookies → auth.riotgames.com → ssid)
