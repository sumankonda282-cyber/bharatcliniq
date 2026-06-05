const DB_NAME = 'bh_provider_cache'
const DB_VERSION = 1
const STORE = 'cache'
// Bump CACHE_VERSION when API response shapes change — old entries are never read
const CACHE_VERSION = 1

export const TTL = {
  QUEUE:          2 * 60 * 1000,  // 2 min   — dashboard queue snapshot
  SHORT:         10 * 60 * 1000,  // 10 min  — patient history, referrals
  MEDIUM:        60 * 60 * 1000,  // 1 hour  — doctor list, tag suggestions
  LONG:  24 * 60 * 60 * 1000,     // 24 hours — reference catalogs (medicines, tests, ICD-10)
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'key' })
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = () => reject(req.error)
  })
}

async function cacheGet(key, ttl = TTL.SHORT) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => {
        const row = req.result
        if (!row || Date.now() - row.ts > ttl) { resolve(null); return }
        resolve(row.value)
      }
      req.onerror = () => resolve(null)
    })
  } catch { return null }
}

async function cacheSet(key, value) {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ key, value, ts: Date.now() })
      tx.oncomplete = resolve
      tx.onerror = resolve
    })
  } catch {}
}

// stale-while-revalidate: show cached instantly, refresh silently in background
export async function cachedFetch(key, apiFn, onFresh, ttl = TTL.SHORT) {
  const cached = await cacheGet(key, ttl)
  if (cached) {
    onFresh(cached)
    apiFn().then(fresh => { cacheSet(key, fresh); onFresh(fresh) }).catch(() => {})
    return cached
  }
  const fresh = await apiFn()
  await cacheSet(key, fresh)
  onFresh(fresh)
  return fresh
}

// one-shot: return cached if fresh, else fetch (no background refresh — for search results)
export async function cachedGet(key, apiFn, ttl = TTL.LONG) {
  const cached = await cacheGet(key, ttl)
  if (cached !== null) return cached
  const fresh = await apiFn()
  await cacheSet(key, fresh)
  return fresh
}

export async function cacheClear() {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
  } catch {}
}

export async function cacheInvalidate(key) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
  } catch {}
}
