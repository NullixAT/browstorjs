![Logo](docs/img/github-logo.png)

# BrowstorJS :rocket: :floppy_disk: :lock: [![Tests](https://github.com/NullixAT/browstorjs/actions/workflows/playwright.yml/badge.svg)](https://github.com/NullixAT/browstorjs/actions/workflows/playwright.yml)

> [!NOTE]  
> Currently working on v2 that will include Filesystem API storage as well. For production uses use the stable v1
> releases for now.

Persistent key/value data storage for your Browser and/or PWA, promisified, including file support and service worker
support, all with IndexedDB or Filesystem API. Perfectly suitable for your next (PWA) app.

## Features :mega:

* Simple Key/Value Data Storage
* Directly serve files/images/videos from storage with `getUrl`
* Promisified for async/await support
* Storage in IndexedDB or Filesystem API
* Cross-Browser
    * Chrome (IDB and/or Filesystem, Mobile/Desktop incl. incognito mode)
    * Firefox (IDB and/or Filesystem, Mobile/Desktop but not in private mode)
    * Safari iOS 
      * Indexed DB, partially in InPrivate Mode
      * Filesystem API only for iOS 16+, partially in InPrivate Mode
    * Edge New (IDB and/or Filesystem, Chromium incl. private mode)
    * Edge Old v17+ (IDB only)
    * WebKit
    * and every other from the last years
    * No Internet Explorer :trollface:
* Lightweight ~4kb gzipped, ~12kb uncompressed
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
function `db.getUrl()` actually work.

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
> This step is required when you use (or fallback to) the Indexed DB mode mode (Second `open` parameter is false or
> browser do not support Filesystem API).

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

> [!NOTE]  
> Following explanation has been last validated on Jan. 2024 - Browsers and APIs evolve quickly and following statements
> are probably outdated. Create an issue if you think so.

One thing you must have definitely in mind is that persistence in a browser is complicated.

`Persistent Storage` in a browser is
persistent over time and after the browser is closed. But, and that's the problem, it can be wiped easily by the
user/OS. Even when your app is installed as a
PWA. A wipe can happen by user request (History wipe), by low disk space, by OS cleanup jobs, by deleting the browser,
etc...

The problem with this behaviour is, the user probably don't know that this actions does wipe PWA data, just simply
because your PWA looks like a normal native app (And not a website running in a browser).

Just because of this reasons, unfortunetely, there is still no real 100% bullet-proof way to store data forever until
the
app is deleted, like you can do in native apps. However, Filesystem API getting close to that. We all hope that someone
will fix this as soon as possible. I can think of a new storage API that is only availabe in a installed PWA that have
it's own permissions and storage location that is not touched by any normal browser wipe action.

> [!NOTE]  
> There is a way to access the users filesystem directly with Filesystem API. This files will be immune to any normal
> browser wipe action but have many problems on it's own. This files are viewable, editable and deletable outside of the
> app itself. Also, to access this files, user interaction and confirmation is required. So we decided to not integrate
> that feature (User selectable storage location) in BrowstorJS.

Here a few links to show how browser engines handle persistent storage:

* https://developer.chrome.com/docs/apps/offline_storage/
* https://web.dev/indexeddb-best-practices/
* https://developers.google.com/privacy-sandbox/3pcd/storage-partitioning?hl=en

## Development in this library :love_letter:

1. Create an issue for features and bugs
2. Checkout master
3. Run `npm install && npm ci && npx playwright install --with-deps`
4. After changing `src/browserjs.ts`, run `npm run dist`
5. Check tests and add new tests to `docs/tests.html` when adding new features