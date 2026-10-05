# val — local only

personal valorant shop checker. runs entirely on your machine.

## run it

**windows:** double-click `start-local.bat`
**mac/linux:** `bash start-local.sh`

then open **http://localhost:10000/val** in your browser.

## how it works

- your ssid cookie is stored in your **browser's localstorage only**
- the backend never stores anything — no database, no files
- each request sends your ssid, backend uses it to talk to riot and forgets it
- anyone can use the hosted version with their own ssid — accounts never clash

## what it needs

- node.js installed ([nodejs.org](https://nodejs.org))
- that's it.

## first run

1. `npm install` inside the `api/` folder (one time only)
2. run the start script
3. paste your ssid cookie from `playvalorant.com` (f12 → application → cookies → auth.riotgames.com → ssid)
