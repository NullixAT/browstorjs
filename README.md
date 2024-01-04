![Logo](docs/img/github-logo.png)

# BrowstorJS :rocket: :floppy_disk: :lock: [![Tests](https://github.com/NullixAT/browstorjs/actions/workflows/playwright.yml/badge.svg)](https://github.com/NullixAT/browstorjs/actions/workflows/playwright.yml)

> [!NOTE]  
> Currently working on v2 that will include Filesystem API storage as well. For production uses use the stable v1 releases for now.

Persistent key/value data storage for your Browser and/or PWA, promisified, including file support and service worker
support, all with IndexedDB or Filesystem API. Perfectly suitable for your next (PWA) app.

## Features :mega:

* Simple Key/Value Data Storage
* Serve any storage value as a real URL (No Data URI) for Images, Files, etc...
* Promisified for async/await support
* Storage in IndexedDB (Traditional) or Filesystem API (New, best persistence)
* Cross-Browser
    * Chrome (IDB and/or Filesystem, Mobile/Desktop incl. incognito mode)
    * Firefox (IDB and/or Filesystem, Mobile/Desktop but not in private mode)
    * Safari (IDB and/or Filesystem, Mobile/Desktop incl. partially in InPrivate Mode)
    * Edge New (IDB and/or Filesystem, Chromium incl. private mode)
    * Edge Old v17+ (IDB only)
    * WebKit
    * and every other from the last years
    * No Internet Explorer :trollface:
* Super Lightweight (~800 byte when gzipped, ~8kb uncompressed)
* Notice: [A word about `persistence` in current browsers...](#persistence---how-browsers-handle-it-shipit)

## Usage :zap:

```javascript
const db = await BrowstorJS.open('browstorjs', true) // get instance that is using filesystem api and IDB as fallback
await db.set('mykey', 'myvalue') // set a value
await db.get('mykey') // get a value
await db.getUrl('mykey') // get a URL that serves the value from this key (eg.: for images)
await db.getDataUri('mykey') // get a data uri (to use as image src for example) for the value of this key
await db.search((key, value) => { return key.startsWith('mykey') }) // search entries with condition
await db.remove('mykey') // remove a single key
await db.reset() // clear the database, delete all entries
await db.getKeys() // ['mykey', ...]
const db = await BrowstorJS.open('myotherdb') // get instance to a separate db with only IDB support
const isPersistent = await BrowstorJS.requestPersistentStorage() // request persistent storage (for IDB usage)
const info = await BrowstorJS.getStorageSpaceInfo() // {available:number, used:number, free:number}
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

> [!NOTE]  
> This step is required when you use (or fallback to) the Indexed DB mode mode (Second `open` parameter is false or browser do not support Filesystem API).

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

One thing you must have definitely in mind is that, to date, persistence in browser is different. 

First, when you use the new Filesystem API (Second `open` is `true`), your data should be as most persistent as it can be. Simply because a normal "clear history" will not erase this data. IndexedDB will be wiped with this actions.

IndexedDB Storage is
persistence over time and after browser is closed, yes, but it can be wiped easily. Even when your app is installed as a
PWA. By cleanup jobs, by long inactivity, by history cleanup, etc...

For PWA (as of July 2022), unfortunetely, there is still no real 100% bullet-proof way to store data forever until the
app is deleted, like you can do in native apps. However, Filesystem API getting close to that. We all hope that browser devs will fix this as soon as possible.

Here a few links to show how browser engines handle IndexedDB Storage, which BrowstorJS internally uses:

* https://developer.chrome.com/docs/apps/offline_storage/
* https://web.dev/indexeddb-best-practices/

## Development in this library :love_letter:

1. Create an issue for features and bugs
2. Checkout master
3. Run `npm install && npm ci && npx playwright install --with-deps`
4. After changing `src/browserjs.ts`, run `npm run dist`
5. Check tests and add new tests to `docs/test.html` when adding new features