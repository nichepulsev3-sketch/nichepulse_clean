const CACHE    = 'nichepulse-v2'
const PRECACHE = ['/', '/dashboard', '/pricing', '/auth/login']

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {})))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  if (request.method !== 'GET') return
  if (!request.url.startsWith(self.location.origin)) return
  if (request.url.includes('/api/') || request.url.includes('supabase')) return
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) { const c=res.clone(); caches.open(CACHE).then(ca=>ca.put(request,c)) }
        return res
      })
      .catch(() => caches.match(request).then(c => c || new Response('Offline',{status:503})))
  )
})
