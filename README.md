# BrowstorJS
Persistent key/value data storage for your Browser and/or PWA, promisified, including file support and service worker support, all with IndexedDB.

## Features

* Simple Key/Value Data Storage in IndexedDB
* Serve any storage value as a real URL (No Data URI) for Images, Files, etc...
* Promisified for async/await support
* Cross-Browser (No Internet Explorer)
* Lightweight

## Usage

```javascript
const db = await BrowstorJS.open() // get instance
await db.set('mykey', 'myvalue') // set a value
await db.get('mykey') // get a value
await db.getUrl('mykey') // get a URL that serves the value from this key (eg.: for images)
await db.search((key, value) => { return key.startsWith('mykey') }) // search entries with condition
await db.remove('mykey') // remove a single key
await db.reset() // clear the database, delete all entries
await db.getKeys() // ['mykey', ...]
```

## Demo
Head to our demo page to see the library in action.

## Event registration inside service worker
To make the generation of `getUrl` work, you need to handle some service worker events. If you don't need `getUrl` you also don't necessarily need a service worker.

This is the bare minimum inside a service worker, you can add your custom code after the BrowstorJS handlers.

```javascript
importScripts('./browstorjs.js')

const browstorjsDbName = "browstorJs"

self.addEventListener('activate',  event => {
  if(BrowstorJS.handleServiceWorkerEvents(event, browstorjsDbName)) return
  // place your additional app code here
})

self.addEventListener('fetch',  event => {
  if(BrowstorJS.handleServiceWorkerEvents(event, browstorjsDbName)) return
  // place your additional app code here
})

self.addEventListener('message',  event => {
  if(BrowstorJS.handleServiceWorkerEvents(event, browstorjsDbName)) return
  // place your additional app code here
})
```