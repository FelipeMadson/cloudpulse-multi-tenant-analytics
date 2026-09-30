/**
 * Mock Service Worker (MSW) Client-Side In-Browser Interceptor
 * Author: Felipe Madison (@FelipeMadson)
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('/health')) {
    event.respondWith(
      new Response(JSON.stringify({ status: "ok", code: 200, checks: "OK" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
  } else if (url.pathname.includes('/api/v1/records') || url.pathname.includes('/api/')) {
    event.respondWith(
      new Response(JSON.stringify({ status: "ok", records: [{ id: "rec_1", title: "Record 1" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
  }
});
