![Logo](docs/img/github-logo.png)

# BrowstorJS :rocket: :floppy_disk: :lock: [![Tests](https://github.com/NullixAT/browstorjs/actions/workflows/playwright.yml/badge.svg)](https://github.com/NullixAT/browstorjs/actions/workflows/playwright.yml)

Persistent key/value data storage for your Browser and/or PWA, promisified, including file support and service worker
support, all with IndexedDB. Perfectly suitable for your next (PWA) app.

## Features :mega:

* Simple Key/Value Data Storage in IndexedDB
* Serve any storage value as a real URL (No Data URI) for Images, Files, etc...
* Promisified for async/await support
* Cross-Browser
    * Chrome (Mobile/Desktop incl. incognito mode)
    * Firefox (Mobile/Desktop but not in private mode)
    * Safari (Mobile/Desktop incl. partially in InPrivate Mode)
    * Edge New (Chromium incl. private mode)
    * Edge Old v17+
    * WebKit
    * and every other from the last years
    * No Internet Explorer :trollface:
* Super Lightweight (~400 byte when gzipped, 3kb uncompressed)
* Notice: [A word about `persistence` in current browsers...](#persistence---how-browsers-handle-it-shipit)

## Usage :zap:

```javascript
const db = await BrowstorJS.open() // get instance
await db.set('mykey', 'myvalue') // set a value
await db.get('mykey') // get a value
await db.getUrl('mykey') // get a URL that serves the value from this key (eg.: for images)
await db.search((key, value) => { return key.startsWith('mykey') }) // search entries with condition
await db.remove('mykey') // remove a single key
await db.reset() // clear the database, delete all entries
await db.getKeys() // ['mykey', ...]
const db = await BrowstorJS.open('myotherdb') // get instance to a separate db
```

Jump to [Event registration inside service worker](#event-registration-inside-service-worker-saxophone) to make the
function `db.getUrl()` to actually work.

## Demo :space_invader:

Head to our [demo page](https://nullixat.github.io/browstorjs) to see and test the library in action.

## Install :cd:

##### Variant Self-Hosted Self-Download

Download the [latest release](https://github.com/NullixAT/browstorjs/releases/latest), unpack the `dist/browstorjs.js`
and load it into your website `<script src="browstorjs.js"></script>`.

##### Variant using TypeScript

Download the  [latest release](https://github.com/NullixAT/browstorjs/releases/latest) (Or use NPM to install the
library) and include `src/browstorjs.ts` wherever you need it.

##### Variant using NPM

```npm install browstorjs```

You know how to pack the library into your website when you opt in for using npm. It depends on your environment
how you integrate the dist file.

##### Variant using CDN (Not recommended but handy for quick tests)

Load it into your website `<script src="https://cdn.jsdelivr.net/npm/browstorjs/dist/browstorjs.js"></script>`.

## Event registration inside service worker :saxophone:

To make the generation of `getUrl` work, you need to handle some service worker events. If you don't need `getUrl` you
also don't necessarily need a service worker.

This is the bare minimum inside a service worker, you can add your custom code after the BrowstorJS handlers.

```javascript
importScripts('scripts/browstorjs.js')

self.addEventListener('activate', event => {
  if (BrowstorJS.handleServiceWorkerEvents(event)) return
  // place your additional app code here
})

self.addEventListener('fetch', event => {
  if (BrowstorJS.handleServiceWorkerEvents(event)) return
  // place your additional app code here
})

self.addEventListener('message', event => {
  if (BrowstorJS.handleServiceWorkerEvents(event)) return
  // place your additional app code here
})
```

## Persistence - How browsers handle it :shipit:

One thing you must have definitely in mind is that, to date, persistence in browser is wanky. IndexedDB Storage is
persistence over time and after browser is closed, yes, but it can be wiped easily. Even when your app is installed as a
PWA. By cleanup jobs, by long inactivity, by history cleanup, etc...

For PWA (as of July 2022), unfortunetely, there is still no real 100% bullet-proof way to store data forever until the
app is deleted, like you can do in native apps. We all hope that browser devs will fix this as soon as possible.

Here a few links to show how browser engines handle IndexedDB Storage, which BrowstorJS internally uses:

* https://developer.chrome.com/docs/apps/offline_storage/
* https://web.dev/indexeddb-best-practices/

## Development in this library :love_letter:

1. Create an issue for features and bugs
2. Checkout master
3. Run `npm install && npm ci && npx playwright install --with-deps`
4. After changing `src/browserjs.ts`, run `npm run dist`
5. Check tests and add new tests to `docs/test.html` when adding new features