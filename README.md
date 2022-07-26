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
await db.search((key, value) => { return key.startsWith('mykey') }) // search entries with condition
await db.remove('mykey') // remove a single key
await db.reset() // clear the database, delete all entries
await db.getKeys() // ['mykey', ...]
```
