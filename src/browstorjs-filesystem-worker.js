const maxRetries = 500
const directoryHandles = {}
const urlFileMap = new Map()
const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function bufferToStr (buffer) {
  return decoder.decode(buffer)
}

/**
 * @param {string} str
 * @returns {Uint8Array}
 */
function strToBuffer (str) {
  return encoder.encode(str)
}

/**
 * Read all parts from a handle
 * @param {FileSystemSyncAccessHandle} handle
 * @returns {ArrayBuffer[]}
 */
function readFromHandle (handle) {
  const maxReadRetries = 10
  let retry = 1
  let buffers = []
  let buffer
  let offset = 0

  function read (buffer, offset) {
    const actual = handle.read(buffer, { at: offset })
    const expected = buffer.byteLength
    if (actual !== expected) {
      throw new Error('Retry read because read bytes do not match buffer size. Actual: ' + actual + ', Expected: ' + expected)
    }
  }

  while (retry++ <= maxReadRetries) {
    try {
      buffers = []
      offset = 0
      buffer = new ArrayBuffer(6)
      buffers.push(buffer)
      read(buffer, offset)
      offset += buffer.byteLength
      const metaLength = parseInt(bufferToStr(buffer))

      buffer = new ArrayBuffer(metaLength)
      buffers.push(buffer)
      if (metaLength) {
        read(buffer, offset)
        offset += buffer.byteLength
      }

      buffer = new ArrayBuffer(handle.getSize() - offset)
      buffers.push(buffer)
      read(buffer, offset)
      return buffers
    } catch (e) {
      console.error(e)
    }
  }
  console.error(['Cannot read buffers from handle', handle, buffers])
  throw new Error('Cannot read buffers from handle')
}

/**
 * Write to a handle a retry a view times if a write fails
 * @param {FileSystemSyncAccessHandle} handle
 * @param {ArrayBuffer[]|Uint8Array[]} buffers
 */
function writeToHandle (handle, buffers) {
  const maxWriteRetries = 10
  let retry = 1
  retryLoop: while (retry++ <= maxWriteRetries) {
    handle.truncate(0)
    let offset = 0
    for (let i = 0; i < buffers.length; i++) {
      const buffer = buffers[i]
      if (!buffer.byteLength) continue
      try {
        const actual = handle.write(buffer, { 'at': offset })
        const expected = buffer.byteLength
        if (actual !== expected) {
          throw new Error('Retry write because written bytes do not match buffer size. Actual: ' + actual + ', Expected: ' + expected)
        }
      } catch (e) {
        console.error(e)
        continue retryLoop
      }
      offset += buffer.byteLength
    }
    handle.flush()
    return
  }
  console.error(['Cannot write buffers to handle', handle, buffers])
  throw new Error('Cannot write buffers to handle')
}

/**
 * @param {number} ms
 * @return {Promise<unknown>}
 */
async function wait (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

/**
 * @param {string} dbName
 * @return {Promise<FileSystemDirectoryHandle>}
 */
async function getDirectory (dbName) {
  if (directoryHandles[dbName]) {
    return directoryHandles[dbName]
  }
  const root = await navigator.storage.getDirectory()
  directoryHandles[dbName] = await root.getDirectoryHandle('browstorjs-' + dbName, { create: true })
  return directoryHandles[dbName]
}

/**
 * @param {string} dbName
 * @param {string} filename
 * @param {boolean} create
 * @return {Promise<null|FileSystemFileHandle>}
 */
async function getFileHandle (dbName, filename, create) {
  let retry = 1
  while (retry <= maxRetries) {
    retry++
    try {
      const root = await getDirectory(dbName)
      return await root.getFileHandle(filename, { 'create': create })
    } catch (e) {
      // not found exception is expected
      if (e.code === 8 && !create) {
        return null
      }
      console.error(e)
      await wait(10)
    }
  }
  throw new Error('Cannot read ' + filename)
}

/**
 * @param {string} dbName
 * @param {string} filename
 * @param {boolean} create
 * @return {Promise<FileSystemSyncAccessHandle|null>}
 */
async function getSyncAccessHandle (dbName, filename, create) {
  const handle = await getFileHandle(dbName, filename, create)
  if (handle) return handle.createSyncAccessHandle()
  return null
}

onmessage = async (e) => {
  const message = e.data
  let filename = ''
  if (message.key) {
    filename = message.key.replace(/[^a-z0-9-_]/ig, '-')
  }
  if (message.type === 'init') {
    await getDirectory(message.dbName)
    self.postMessage({ 'id': message.id })
  }
  if (message.type === 'test-support') {
    let accessHandle = await getSyncAccessHandle(message.dbName, '__browstorjs_test__', true)
    if (accessHandle) {
      try {
        const writeBuffer = new Uint8Array(1)
        writeBuffer[0] = 0
        writeToHandle(accessHandle, [writeBuffer])
        const buffer = new Uint8Array(1)
        accessHandle.read(buffer, { 'at': 0 })
        accessHandle.close()
        const dir = await getDirectory(message.dbName)
        await dir.removeEntry('__browstorjs_test__')
        self.postMessage({ 'id': message.id, 'result': buffer[0] === 0 })
        return
      } catch (e) {
        accessHandle.close()
      }
    }
    self.postMessage({ 'id': message.id, 'result': false })
  }
  if (message.type === 'list') {
    const filenames = []
    const root = await getDirectory(message.dbName)
    for await (const handle of root.values()) {
      if (handle.kind === 'file') {
        const file = await handle.getFile()
        if (file !== null) {
          filenames.push(file.name)
          if (message.data && message.data.limit && filenames.length >= message.data.limit) {
            break
          }
        }
      }
    }
    filenames.sort()
    self.postMessage({ 'id': message.id, 'list': filenames })
  }
  if (message.type === 'read-url') {
    let fileHandle = await getFileHandle(message.dbName, filename, false)
    let url = null
    if (fileHandle) {
      const file = await fileHandle.getFile()
      url = urlFileMap.get(file)
      if (!url) {
        const accessHandle = await getSyncAccessHandle(message.dbName, filename, false)
        if (accessHandle) {
          const buffers = readFromHandle(accessHandle)
          accessHandle.close()
          const meta = JSON.parse(bufferToStr(buffers[1]))
          url = URL.createObjectURL(new Blob([buffers[2]], { 'type': meta.blobType }))
          urlFileMap.set(file, url)
        }
      }
    }
    self.postMessage({ 'id': message.id, 'url': url })
  }
  if (message.type === 'read') {
    let accessHandle = await getSyncAccessHandle(message.dbName, filename, false)
    let buffers = null
    let meta = null
    let contents = null
    if (accessHandle) {
      buffers = readFromHandle(accessHandle)
      accessHandle.close()
    }
    if (buffers) {
      if (parseInt(bufferToStr(buffers[0]))) {
        try {
          meta = JSON.parse(bufferToStr(buffers[1]))
        } catch (e) {
          console.error(e)
        }
      }
      if (meta && meta.type === 'blob') {
        contents = new Blob([buffers[2]], { 'type': meta.blobType })
      }
      if (!meta || meta.type === 'json') {
        contents = bufferToStr(buffers[2])
        try {
          contents = JSON.parse(contents)
        } catch (e) {
          console.error(e)
        }
      }
    }
    self.postMessage({ 'id': message.id, 'meta': meta, 'contents': contents })
  }
  if (message.type === 'write') {
    let accessHandle = await getSyncAccessHandle(message.dbName, filename, true)
    if (!accessHandle) {
      throw new Error('Cannot open file ' + filename)
    }
    let contents = message.data
    let meta = ''
    if (contents instanceof Blob) {
      meta = JSON.stringify({ 'type': 'blob', 'blobType': contents.type })
      contents = await new Promise(function (resolve) {
        const reader = new FileReader()
        reader.addEventListener('load', () => {
          resolve(reader.result)
        })
        reader.readAsArrayBuffer(contents)
      })
    } else {
      contents = strToBuffer(JSON.stringify(contents))
    }
    writeToHandle(accessHandle, [strToBuffer(meta.length.toString().padStart(6)), strToBuffer(meta), contents])
    accessHandle.close()
    self.postMessage({ 'id': message.id, 'result': 0 })
  }
  if (message.type === 'remove') {
    const fileHandle = await getFileHandle(message.dbName, filename, false)
    if (fileHandle) {
      const file = await fileHandle.getFile()
      const url = urlFileMap.get(file)
      if (url) {
        URL.revokeObjectURL(url)
        urlFileMap.delete(file)
      }
      const root = await getDirectory(message.dbName)
      try {
        await root.removeEntry(filename)
      } catch (e) {
        console.error(e)
      }
      self.postMessage({ 'id': message.id })
    }
  }
  if (message.type === 'reset') {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry('browstorjs-' + message.dbName, { 'recursive': true })
    delete directoryHandles[message.dbName]
    self.postMessage({ 'id': message.id })
  }
}