class BrowstorJS {
    static handleServiceWorkerEvents(event, dbName = "browstorJs", claim = true) {
        const fileUrlPrefix = "/__browstorJsfile__";
        switch (event.type) {
            case 'activate':
                if (!BrowstorJS.serviceWorkersActive.promises[dbName]) {
                    BrowstorJS.serviceWorkersActive.promises[dbName] = new Promise(function (resolve) {
                        BrowstorJS.serviceWorkersActive.resolvers[dbName] = resolve;
                    });
                }
                if (BrowstorJS.serviceWorkersActive.resolvers[dbName]) {
                    BrowstorJS.serviceWorkersActive.resolvers[dbName]();
                    delete BrowstorJS.serviceWorkersActive.resolvers[dbName];
                }
                if (claim) {
                    self.clients.claim();
                }
                break;
            case 'fetch':
                const url = event.request.url;
                if (!url.includes(fileUrlPrefix)) {
                    return false;
                }
                const key = url.substring(url.lastIndexOf(fileUrlPrefix) + fileUrlPrefix.length);
                event.respondWith(new Promise(async function (resolve) {
                    const value = await (await BrowstorJS.open(dbName)).get(key);
                    resolve(new Response(value, {
                        'status': value === null ? 404 : 200,
                        'statusText': 'browstorJs File'
                    }));
                }));
                return true;
            case 'message':
                const msg = event.data;
                if (!msg || !msg.browstorJsGetFileUrl)
                    return false;
                if (claim) {
                    self.clients.claim();
                }
                dbName = msg.browstorJsGetFileUrl.dbName;
                if (!BrowstorJS.serviceWorkersActive.promises[dbName]) {
                    BrowstorJS.serviceWorkersActive.promises[dbName] = new Promise(function (resolve) {
                        BrowstorJS.serviceWorkersActive.resolvers[dbName] = resolve;
                    });
                }
                BrowstorJS.serviceWorkersActive.promises[dbName].then(function () {
                    event.source.postMessage({
                        'browstorJsFileUrl': {
                            'dbName': dbName,
                            'key': msg.browstorJsGetFileUrl.key,
                            'url': fileUrlPrefix + msg.browstorJsGetFileUrl.key
                        }
                    });
                });
                break;
        }
        return false;
    }
    static async open(dbName = "browstorJs") {
        if (typeof BrowstorJS.instances[dbName] !== 'undefined' && BrowstorJS.instances[dbName])
            return BrowstorJS.instances[dbName];
        return new Promise(function (resolve, reject) {
            const request = indexedDB.open(dbName, 1);
            request.onsuccess = function () {
                const db = new BrowstorJS();
                BrowstorJS.instances[dbName] = db;
                db.dbName = dbName;
                db.idb = request.result;
                db.idb.addEventListener('close', function () {
                    BrowstorJS.instances[dbName] = null;
                });
                resolve(db);
            };
            request.onerror = function (e) {
                console.error(e);
                reject(e);
            };
            request.onupgradeneeded = function (event) {
                const db = event.target.result;
                if (db.objectStoreNames.contains(dbName))
                    return;
                let objectStore = db.createObjectStore(dbName, { keyPath: 'key' });
                objectStore.createIndex('key', 'key', { unique: true });
            };
        });
    }
    async set(key, value) {
        const self = this;
        return new Promise(async function (resolve, reject) {
            await self.checkConnection();
            const db = self.idb;
            const transaction = db.transaction([self.dbName], 'readwrite');
            const objectStore = transaction.objectStore(self.dbName);
            const request = objectStore.put({ 'key': key, 'value': value });
            request.onsuccess = function () {
                resolve();
            };
            request.onerror = function (e) {
                console.error(e);
                reject(e);
            };
        });
    }
    async get(key) {
        const self = this;
        return new Promise(async function (resolve, reject) {
            await self.checkConnection();
            const db = self.idb;
            const transaction = db.transaction([self.dbName], 'readonly');
            const objectStore = transaction.objectStore(self.dbName);
            const request = objectStore.get(key);
            request.onsuccess = function () {
                resolve(request.result && typeof request.result.value !== 'undefined' ? request.result.value : null);
            };
            request.onerror = function (e) {
                console.error(e);
                reject(e);
            };
        });
    }
    async search(callback) {
        const self = this;
        return new Promise(async function (resolve, reject) {
            await self.checkConnection();
            const db = self.idb;
            const transaction = db.transaction([self.dbName], 'readonly');
            const objectStore = transaction.objectStore(self.dbName);
            const request = objectStore.openCursor();
            const result = {};
            request.onsuccess = async function (event) {
                const cursor = event.target.result;
                if (cursor) {
                    if (await callback(cursor.key, cursor.value)) {
                        result[cursor.key] = cursor.value;
                    }
                    cursor.continue();
                }
            };
            transaction.oncomplete = function (e) {
                resolve(result);
            };
            request.onerror = function (e) {
                console.error(e);
                reject(e);
            };
        });
    }
    async getUrl(key) {
        const self = this;
        return new Promise(function (resolve) {
            navigator.serviceWorker.addEventListener("message", (evt) => {
                if (evt.data && evt.data.browstorJsFileUrl && evt.data.browstorJsFileUrl.dbName === self.dbName && evt.data.browstorJsFileUrl.key === key) {
                    resolve(evt.data.browstorJsFileUrl.url);
                }
            });
            navigator.serviceWorker.ready.then(function (serviceWorker) {
                serviceWorker.active.postMessage({
                    'browstorJsGetFileUrl': { 'dbName': self.dbName, 'key': key }
                });
            });
        });
    }
    async remove(key) {
        const self = this;
        return new Promise(async function (resolve, reject) {
            await self.checkConnection();
            const db = self.idb;
            const transaction = db.transaction([self.dbName], 'readwrite');
            const objectStore = transaction.objectStore(self.dbName);
            const request = objectStore.delete(key);
            request.onsuccess = function () {
                resolve();
            };
            request.onerror = function (e) {
                console.error(e);
                reject(e);
            };
        });
    }
    async getKeys() {
        const self = this;
        return new Promise(async function (resolve, reject) {
            await self.checkConnection();
            const db = self.idb;
            const transaction = db.transaction([self.dbName], 'readonly');
            const objectStore = transaction.objectStore(self.dbName);
            const myIndex = objectStore.index('key');
            const request = myIndex.getAllKeys();
            request.onsuccess = function () {
                resolve(request.result);
            };
            request.onerror = function (e) {
                console.error(e);
                reject(e);
            };
        });
    }
    async reset() {
        const self = this;
        return new Promise(async function (resolve, reject) {
            await self.checkConnection();
            const db = self.idb;
            const transaction = db.transaction([self.dbName], 'readwrite');
            const objectStore = transaction.objectStore(self.dbName);
            const request = objectStore.clear();
            request.onsuccess = async function () {
                resolve();
            };
            request.onerror = function (e) {
                console.error(e);
                reject(e);
            };
        });
    }
    checkConnection() {
        let self = this;
        return new Promise(async function (resolve, reject) {
            const db = self.idb;
            let transaction;
            try {
                transaction = db.transaction([self.dbName], 'readwrite');
                transaction.abort();
                resolve();
                return;
            }
            catch (e) {
            }
            try {
                if (transaction)
                    transaction.abort();
                if (self.idb)
                    self.idb.close();
                BrowstorJS.instances[self.dbName] = null;
                const newInstance = await BrowstorJS.open(self.dbName);
                self.idb = newInstance.idb;
                resolve();
                return;
            }
            catch (e) {
            }
        });
    }
}
BrowstorJS.instances = {};
BrowstorJS.serviceWorkersActive = {
    'promises': {},
    'resolvers': {}
};
