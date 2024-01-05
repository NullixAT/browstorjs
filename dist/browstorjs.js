// BrowstorJS v2.0.0 @ https://github.com/NullixAT/browstorjs
/**
 * BrowstorJS
 * Persistent key/value data storage for your Browser and/or PWA, promisified, including file support and service worker support, all with IndexedDB.
 * @url https://github.com/NullixAT/browstorjs
 */
class BrowstorJS {
    constructor() {
        /**
         * Internal counter for the worker messages
         * @private
         */
        this.workerMsgCount = 0;
        /**
         * Internal callbacks for the worker messages
         * @type {Object<number, function>}
         * @private
         */
        this.workerMsgCallbacks = {};
    }
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
                const urlData = msg.browstorJsGetFileUrl;
                event.source.postMessage({
                    'browstorJsFileUrl': {
                        'key': msg.browstorJsGetFileUrl.key,
                        'url': fileUrlPrefix + urlData.key + '/' + urlData.filesystemApi + '/' + urlData.dbName + (urlData.addAntiCacheParam ? '?c=' + Math.random() : '')
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
                const key = urlSplit[urlSplit.length - 3];
                const filesystemApi = urlSplit[urlSplit.length - 2];
                const dbName = urlSplit[urlSplit.length - 1].split('?')[0];
                // @ts-ignore
                event.respondWith(new Promise(async function (resolve) {
                    const value = await (await BrowstorJS.open(dbName, filesystemApi === '1')).get(key);
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
     * Request persistent storage that is not cleared by default browser clearing mechanism
     * Call this function only inside a user gesture event (click), otherwise it may not work in some browsers
     * See https://web.dev/persistent-storage/ for more information
     * Safari, Old Edge and older browsers in general don't support this
     * @returns {Promise<boolean>}
     */
    static async requestPersistentStorage() {
        if (!navigator.storage || !navigator.storage.persist)
            return false;
        if (await navigator.storage.persisted())
            return true;
        return await navigator.storage.persist();
    }
    /**
     * Get storage space info in bytes
     * If a browser don't support this, it will return -1 values
     * @returns {Promise<{available:number, used:number, free:number}>}
     */
    static async getStorageSpaceInfo() {
        if (!navigator.storage || !navigator.storage.estimate)
            return { available: -1, used: -1, free: -1 };
        const est = await navigator.storage.estimate();
        return { available: est.quota, used: est.usage, free: est.quota - est.usage };
    }
    /**
     * Check if the filesystem api is available on this device
     */
    static isFilesystemApiAvailable() {
        return !(typeof Worker === 'undefined' || typeof navigator === 'undefined' || typeof navigator.storage === 'undefined' || typeof navigator.storage.getDirectory === 'undefined');
    }
    /**
     * Get/Create instance for given db name
     * @param {string} dbName
     * @param {boolean} useFilesystemApi Use the Filesystem API with OPFS instead of IndexedDB (Recommended for better persistance)
     *  If the API is not available on the users device, it will fallback to IndexedDB instead
     * @returns {Promise<BrowstorJS>}
     */
    static async open(dbName = 'browstorJs', useFilesystemApi = false) {
        const instanceId = dbName + '__' + (useFilesystemApi ? '1' : '0');
        if (typeof BrowstorJS.instances[instanceId] !== 'undefined' && BrowstorJS.instances[instanceId])
            return BrowstorJS.instances[instanceId];
        let db = new BrowstorJS();
        db.instanceId = instanceId;
        if (useFilesystemApi && BrowstorJS.isFilesystemApiAvailable()) {
            db.instanceId = instanceId;
            BrowstorJS.instances[db.instanceId] = db;
            db.dbName = dbName;
            await db.startFilesystemWorker();
            // check if filesystem api works properly (safari on IOS cannot write due to bugs in older versions)
            const testResult = await db.postMessageToWorker('test-support');
            if (testResult.result) {
                return db;
            }
            console.warn('Fallback to IndexedDB because Filesystem API does not work');
            // fallback to indexed db
            delete BrowstorJS.instances[db.instanceId];
            db = new BrowstorJS();
        }
        return new Promise(function (resolve, reject) {
            const request = indexedDB.open(dbName, 1);
            request.onsuccess = function () {
                BrowstorJS.instances[db.instanceId] = db;
                db.dbName = dbName;
                db.idb = request.result;
                // on db close, unset instance to make it reload
                db.idb.addEventListener('close', function () {
                    BrowstorJS.instances[db.instanceId] = null;
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
     * Post a message to the filesystem worker and return the result
     * @param {string} type
     * @param {string} key
     * @param {*} data
     * @returns {Promise<any>}
     */
    async postMessageToWorker(type, key = null, data = null) {
        const self = this;
        const id = self.workerMsgCount;
        self.workerMsgCount++;
        return new Promise(async function (resolve) {
            self.workerMsgCallbacks[id] = async function (message) {
                delete self.workerMsgCallbacks[id];
                resolve(message);
            };
            self.worker.postMessage({
                'id': id,
                'type': type,
                'dbName': self.dbName,
                'key': key,
                'data': data
            });
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
        if (this.worker) {
            await this.checkConnection();
            await this.postMessageToWorker('write', key, value);
            return;
        }
        value = await self.convertValue(value, 'data');
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
        if (this.worker) {
            await this.checkConnection();
            return (await this.postMessageToWorker('read', key)).contents;
        }
        return new Promise(async function (resolve, reject) {
            await self.checkConnection();
            const db = self.idb;
            const transaction = db.transaction([self.dbName], 'readonly');
            const objectStore = transaction.objectStore(self.dbName);
            const request = objectStore.get(key);
            request.onsuccess = function () {
                // @ts-ignore
                resolve(request.result && typeof request.result.value !== 'undefined' ? self.convertValue(request.result.value, 'blob') : null);
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
        if (this.worker) {
            await this.checkConnection();
            const list = (await this.postMessageToWorker('list')).list;
            const result = {};
            for (let i = 0; i < list.length; i++) {
                const key = list[i];
                const value = await this.get(key);
                if (await callback(key, value)) {
                    result[key] = value;
                }
            }
            return result;
        }
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
                        result[cursor.key] = await self.convertValue(cursor.value.value, 'blob');
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
     * @param {boolean} nullIfKeyNotExist Return null when the key not exist in db (default is return the url anyway)
     * @param {boolean} addAntiCacheParam Add ?c=randomnumber to the generated to prevent browser memory-caching
     * @return {Promise<string|null>} Null if key does not exist and option is enabled
     */
    async getUrl(key, nullIfKeyNotExist = false, addAntiCacheParam) {
        if (this.worker) {
            await this.checkConnection();
            return (await this.postMessageToWorker('read-url', key)).url || nullIfKeyNotExist;
        }
        // is undefined in private browsing mode in some browsers or in ancient browsers
        if (typeof navigator.serviceWorker === 'undefined') {
            const can = document.createElement('canvas');
            can.width = 100;
            can.height = 30;
            const ctx = can.getContext('2d');
            ctx.font = '9px sans-serif';
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, can.width, can.height);
            ctx.fillStyle = 'white';
            ctx.fillText('service worker unsupported', 1, 9, 100);
            ctx.fillText('old browser or', 1, 18, 100);
            ctx.fillText('in incognito mode', 1, 27, 100);
            return can.toDataURL('image/png');
        }
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
                    'browstorJsGetFileUrl': {
                        'dbName': self.dbName,
                        'filesystemApi': self.worker ? 1 : 0,
                        'key': key,
                        'addAntiCacheParam': addAntiCacheParam
                    }
                });
            });
        });
    }
    /**
     * Get a data uri that can be used as href or src for images
     * @param {string} key
     * @param {string|null} defaultReturn The default value that is returned in case the key does not exist
     * @return {Promise<string>}
     */
    async getDataUri(key, defaultReturn = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=') {
        const value = await this.get(key);
        if (!(value instanceof Blob))
            return defaultReturn;
        return new Promise(function (resolve) {
            const reader = new FileReader();
            // @ts-ignore
            reader.onload = function (e) { resolve(reader.result); };
            reader.readAsDataURL(value);
        });
    }
    /**
     * Remove key
     * @param {string} key
     * @returns {Promise<void>}
     */
    async remove(key) {
        const self = this;
        if (this.worker) {
            await this.checkConnection();
            await this.postMessageToWorker('remove', key);
            return;
        }
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
     * Get all keys stored in the database
     * @returns {Promise<string[]>}
     */
    async getKeys() {
        const self = this;
        if (this.worker) {
            await this.checkConnection();
            return (await this.postMessageToWorker('list')).list;
        }
        return new Promise(async function (resolve, reject) {
            await self.checkConnection();
            const db = self.idb;
            const transaction = db.transaction([self.dbName], 'readonly');
            const objectStore = transaction.objectStore(self.dbName);
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
        if (this.worker) {
            await this.checkConnection();
            await this.postMessageToWorker('reset');
            return;
        }
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
     * Check connection and reconnect when db/worker has been closed/destroyed/terminated
     * @param {number} retryCounter The number of retries already done
     * @private
     * @returns {Promise<void>}
     */
    async checkConnection(retryCounter = 1) {
        let self = this;
        if (this.worker) {
            const maxRetries = 50;
            if (retryCounter >= maxRetries) {
                throw new Error('Cannot connect to the Filesystem service worker');
            }
            return new Promise(async function (resolve) {
                const timeout = setTimeout(async function () {
                    // if we reach the timeout (worker does not answer), we consider it broken
                    // recreate in this case and re-check
                    console.warn('Recreate BrowstorJS Filesystem Worker connection after inactivity');
                    self.startFilesystemWorker();
                    resolve(self.checkConnection(retryCounter + 1));
                }, 100);
                await self.postMessageToWorker('init');
                clearTimeout(timeout);
                resolve();
            });
        }
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
                console.warn('Recreate BrowstorJS DB connection after inactivity');
                if (transaction)
                    transaction.abort();
                if (self.idb)
                    self.idb.close();
                BrowstorJS.instances[self.instanceId] = null;
                const newInstance = await BrowstorJS.open(self.dbName);
                self.idb = newInstance.idb;
                resolve();
                return;
            }
            catch (e) {
            }
        });
    }
    /**
     * Convert a blob into object with arraybuffer data
     * @param {Blob} blob
     * @returns {Promise<object>}
     * @private
     */
    async blobToBlobDataObject(blob) {
        const data = { 'type': 'browstorJsBlobData', 'blobData': null, 'blobType': blob.type };
        return new Promise(function (resolve) {
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                data.blobData = reader.result;
                resolve(data);
            });
            reader.readAsArrayBuffer(blob);
        });
    }
    /**
     * Convert a blob object with arraybuffer into blob
     * @param {object} blobData
     * @private
     */
    blobDataObjectToBlob(blobData) {
        // @ts-ignore
        return new Blob([blobData.blobData], { type: blobData.blobType });
    }
    /**
     * Convert value from and to blob if required
     * Otherwise, just pass value through without modification
     * @param {any} value
     * @param {string} to To which format: blob or data
     * @returns {Promise<any>}
     * @private
     */
    async convertValue(value, to) {
        if (value === null || value === undefined) {
            return null;
        }
        else if (value instanceof Blob && to === 'data') {
            return this.blobToBlobDataObject(value);
        }
        else if (to === 'blob' && typeof value === 'object' && typeof value.type !== 'undefined' && value.type === 'browstorJsBlobData') {
            return this.blobDataObjectToBlob(value);
        }
        else {
            return value;
        }
    }
    /**
     * Starting the filesystem worker thread
     * @private
     */
    async startFilesystemWorker() {
        const selfInstance = this;
        const workerJs = `const maxRetries=500,directoryHandles={},urlFileMap=new Map,encoder=new TextEncoder,decoder=new TextDecoder;function bufferToStr(n){return decoder.decode(n)}function strToBuffer(n){return encoder.encode(n)}function readFromHandle(n){let i=1,r=[],t,a=0;function o(s,c){const l=n.read(s,{at:c}),f=s.byteLength;if(l!==f)throw new Error("Retry read because read bytes do not match buffer size. Actual: "+l+", Expected: "+f)}for(;i++<=10;)try{r=[],a=0,t=new ArrayBuffer(6),r.push(t),o(t,a),a+=t.byteLength;const s=parseInt(bufferToStr(t));return t=new ArrayBuffer(s),r.push(t),s&&(o(t,a),a+=t.byteLength),t=new ArrayBuffer(n.getSize()-a),r.push(t),o(t,a),r}catch(s){console.error(s)}throw console.error(["Cannot read buffers from handle",n,r]),new Error("Cannot read buffers from handle")}function writeToHandle(n,e){let r=1;e:for(;r++<=10;){n.truncate(0);let t=0;for(let a=0;a<e.length;a++){const o=e[a];if(o.byteLength){try{const s=n.write(o,{at:t}),c=o.byteLength;if(s!==c)throw new Error("Retry write because written bytes do not match buffer size. Actual: "+s+", Expected: "+c)}catch(s){console.error(s);continue e}t+=o.byteLength}}n.flush();return}throw console.error(["Cannot write buffers to handle",n,e]),new Error("Cannot write buffers to handle")}async function wait(n){return new Promise(function(e){setTimeout(e,n)})}async function getDirectory(n){if(directoryHandles[n])return directoryHandles[n];const e=await navigator.storage.getDirectory();return directoryHandles[n]=await e.getDirectoryHandle("browstorjs-"+n,{create:!0}),directoryHandles[n]}async function getFileHandle(n,e,i){let r=1;for(;r<=500;){r++;try{return await(await getDirectory(n)).getFileHandle(e,{create:i})}catch(t){if(t.code===8&&!i)return null;console.error(t),await wait(10)}}throw new Error("Cannot read "+e)}async function getSyncAccessHandle(n,e,i){const r=await getFileHandle(n,e,i);return r?r.createSyncAccessHandle():null}onmessage=async n=>{const e=n.data;let i="";if(e.key&&(i=e.key.replace(/[^a-z0-9-_]/ig,"-")),e.type==="init"&&(await getDirectory(e.dbName),self.postMessage({id:e.id})),e.type==="test-support"){let r=await getSyncAccessHandle(e.dbName,"__browstorjs_test__",!0);if(r)try{const t=new Uint8Array(1);t[0]=0,writeToHandle(r,[t]);const a=new Uint8Array(1);r.read(a,{at:0}),r.close(),await(await getDirectory(e.dbName)).removeEntry("__browstorjs_test__"),self.postMessage({id:e.id,result:a[0]===0});return}catch{r.close()}self.postMessage({id:e.id,result:!1})}if(e.type==="list"){const r=[],t=await getDirectory(e.dbName);for await(const a of t.values())if(a.kind==="file"){const o=await a.getFile();if(o!==null&&(r.push(o.name),e.data&&e.data.limit&&r.length>=e.data.limit))break}r.sort(),self.postMessage({id:e.id,list:r})}if(e.type==="read-url"){let r=await getFileHandle(e.dbName,i,!1),t=null;if(r){const a=await r.getFile();if(t=urlFileMap.get(a),!t){const o=await getSyncAccessHandle(e.dbName,i,!1);if(o){const s=readFromHandle(o);o.close();const c=JSON.parse(bufferToStr(s[1]));t=URL.createObjectURL(new Blob([s[2]],{type:c.blobType})),urlFileMap.set(a,t)}}}self.postMessage({id:e.id,url:t})}if(e.type==="read"){let r=await getSyncAccessHandle(e.dbName,i,!1),t=null,a=null,o=null;if(r&&(t=readFromHandle(r),r.close()),t){if(parseInt(bufferToStr(t[0])))try{a=JSON.parse(bufferToStr(t[1]))}catch(s){console.error(s)}if(a&&a.type==="blob"&&(o=new Blob([t[2]],{type:a.blobType})),!a||a.type==="json"){o=bufferToStr(t[2]);try{o=JSON.parse(o)}catch(s){console.error(s)}}}self.postMessage({id:e.id,meta:a,contents:o})}if(e.type==="write"){let r=await getSyncAccessHandle(e.dbName,i,!0);if(!r)throw new Error("Cannot open file "+i);let t=e.data,a="";t instanceof Blob?(a=JSON.stringify({type:"blob",blobType:t.type}),t=await new Promise(function(o){const s=new FileReader;s.addEventListener("load",()=>{o(s.result)}),s.readAsArrayBuffer(t)})):t=strToBuffer(JSON.stringify(t)),writeToHandle(r,[strToBuffer(a.length.toString().padStart(6)),strToBuffer(a),t]),r.close(),self.postMessage({id:e.id,result:0})}if(e.type==="remove"){const r=await getFileHandle(e.dbName,i,!1);if(r){const t=await r.getFile(),a=urlFileMap.get(t);a&&(URL.revokeObjectURL(a),urlFileMap.delete(t));const o=await getDirectory(e.dbName);try{await o.removeEntry(i)}catch(s){console.error(s)}self.postMessage({id:e.id})}}e.type==="reset"&&(await(await navigator.storage.getDirectory()).removeEntry("browstorjs-"+e.dbName,{recursive:!0}),delete directoryHandles[e.dbName],self.postMessage({id:e.id}))};`;
        // terminate old worker if any exist
        if (selfInstance.worker) {
            selfInstance.worker.terminate();
        }
        selfInstance.worker = new Worker(URL.createObjectURL(new Blob([workerJs], { type: 'application/javascript' })));
        selfInstance.worker.addEventListener('message', function (e) {
            const message = e.data;
            if (selfInstance.workerMsgCallbacks[message.id]) {
                selfInstance.workerMsgCallbacks[message.id](message);
            }
        });
        await selfInstance.postMessageToWorker('init');
    }
}
/**
 * All instances
 * @type {Object<string, BrowstorJS>}
 */
BrowstorJS.instances = {};
