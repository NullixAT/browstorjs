// BrowstorJS v1.0.0 @ https://github.com/NullixAT/browstorjs
/**
 * BrowstorJS
 * Persistent key/value data storage for your Browser and/or PWA, promisified, including file support and service worker support, all with IndexedDB.
 * @url https://github.com/NullixAT/browstorjs
 */
class BrowstorJS {
    /**
     * Handle service worker events
     * @param {any} event
     * @param {boolean} claim Does automatically call self.clients.claim() to make sure that after SW updates the events are handled properly
     *  If you do not do this, it is possible that first open of a website or updates of SW temporarily cannot display file urls from browstorJs
     *  cecause the 'fetch' event never gets fired
     * @returns {boolean} Returns true if event is handled by this function, you need to stop further processing if this is true
     */
    static handleServiceWorkerEvents(event, claim = true) {
        const fileUrlPrefix = '_browstorJS/';
        switch (event.type) {
            case 'activate':
                if (claim) {
                    // @ts-ignore
                    self.clients.claim();
                }
                break;
            case 'message':
                if (claim) {
                    // @ts-ignore
                    self.clients.claim();
                }
                // @ts-ignore
                const msg = event.data;
                if (!msg || !msg.browstorJsGetFileUrl)
                    return false;
                // @ts-ignore
                event.source.postMessage({
                    'browstorJsFileUrl': {
                        'key': msg.browstorJsGetFileUrl.key,
                        'url': fileUrlPrefix + msg.browstorJsGetFileUrl.key + '/' + msg.browstorJsGetFileUrl.dbName
                    }
                });
                break;
            case 'fetch':
                // @ts-ignore
                const url = event.request.url;
                if (!url.includes(fileUrlPrefix)) {
                    return false;
                }
                const urlSplit = url.split('/');
                const key = urlSplit[urlSplit.length - 2];
                const dbName = urlSplit[urlSplit.length - 1];
                // @ts-ignore
                event.respondWith(new Promise(async function (resolve) {
                    const value = await (await BrowstorJS.open(dbName)).get(key);
                    resolve(new Response(value, {
                        'status': value === null ? 404 : 200,
                        'statusText': 'browstorJs File'
                    }));
                }));
                return true;
        }
        return false;
    }
    /**
     * Get/Create instance for given db name
     * @param {string} dbName
     * @returns {Promise<BrowstorJS>}
     */
    static async open(dbName = 'browstorJs') {
        if (typeof BrowstorJS.instances[dbName] !== 'undefined' && BrowstorJS.instances[dbName])
            return BrowstorJS.instances[dbName];
        return new Promise(function (resolve, reject) {
            const request = indexedDB.open(dbName, 1);
            request.onsuccess = function () {
                const db = new BrowstorJS();
                BrowstorJS.instances[dbName] = db;
                db.dbName = dbName;
                db.idb = request.result;
                // on db close, unset instance to make it reload
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
                // @ts-ignore
                const db = event.target.result;
                if (db.objectStoreNames.contains(dbName))
                    return;
                let objectStore = db.createObjectStore(dbName, { keyPath: 'key' });
                objectStore.createIndex('key', 'key', { unique: true });
            };
        });
    }
    /**
     * Set value for given key
     * For files, the value should be a Blob
     * @param {string} key
     * @param {any} value
     * @returns {Promise<void>}
     */
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
    /**
     * Get value for given key
     * If key not exist, it will return null
     * @param {string} key
     * @returns {Promise<any>}
     */
    async get(key) {
        const self = this;
        return new Promise(async function (resolve, reject) {
            await self.checkConnection();
            const db = self.idb;
            const transaction = db.transaction([self.dbName], 'readonly');
            const objectStore = transaction.objectStore(self.dbName);
            const request = objectStore.get(key);
            request.onsuccess = function () {
                // @ts-ignore
                resolve(request.result && typeof request.result.value !== 'undefined' ? request.result.value : null);
            };
            request.onerror = function (e) {
                console.error(e);
                reject(e);
            };
        });
    }
    /**
     * Get all entries matching your rules
     * @param {function} callback Must return true to be in return list
     *  First parameter is key, second is value
     * @returns {Promise<Object>}
     */
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
                // @ts-ignore
                const cursor = event.target.result;
                if (cursor) {
                    if (await callback(cursor.key, cursor.value)) {
                        result[cursor.key] = cursor.value.value;
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
    /**
     * Get file url to given storage key
     * @param {string} key
     * @return {Promise<string>}
     */
    async getUrl(key) {
        const self = this;
        return new Promise(function (resolve) {
            // get message from service worker that contains the url when everything is ready to serve this url
            navigator.serviceWorker.addEventListener('message', (evt) => {
                if (evt.data && evt.data.browstorJsFileUrl && evt.data.browstorJsFileUrl.key === key) {
                    resolve(evt.data.browstorJsFileUrl.url);
                }
            });
            // send message to service worker to request the file url
            navigator.serviceWorker.ready.then(function (serviceWorker) {
                serviceWorker.active.postMessage({
                    'browstorJsGetFileUrl': { 'dbName': self.dbName, 'key': key }
                });
            });
        });
    }
    /**
     * Remove key
     * @param {string} key
     * @returns {Promise<void>}
     */
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
    /**
     * Get all keys
     * @returns {Promise<string[]>}
     */
    async getKeys() {
        const self = this;
        return new Promise(async function (resolve, reject) {
            await self.checkConnection();
            const db = self.idb;
            const transaction = db.transaction([self.dbName], 'readonly');
            const objectStore = transaction.objectStore(self.dbName);
            const myIndex = objectStore.index('key');
            const request = objectStore.openCursor();
            const result = [];
            request.onsuccess = async function (event) {
                // @ts-ignore
                const cursor = event.target.result;
                if (cursor) {
                    result.push(cursor.key);
                    cursor.continue();
                }
            };
            request.onerror = function (e) {
                console.error(e);
                reject(e);
            };
            transaction.oncomplete = function (e) {
                resolve(result);
            };
        });
    }
    /**
     * Remove all data in the database
     * @returns {Promise<void>}
     */
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
    /**
     * Check connection and reconnect when db has been closed/destroyed
     * @private
     * @returns {Promise<void>}
     */
    checkConnection() {
        let self = this;
        return new Promise(async function (resolve, reject) {
            const db = self.idb;
            // when a transaction can't be opened, close db and reopen it
            // this can happen after some time of inactivity
            // whenever the browser decide to close the database for energy saving
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
/**
 * All instances
 * @type {Object<string, BrowstorJS>}
 */
BrowstorJS.instances = {};
