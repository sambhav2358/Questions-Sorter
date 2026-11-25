if (typeof window === 'undefined') {
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
    self.addEventListener('fetch', (e) => {
        if (e.request.cache === 'only-if-cached' && e.request.mode !== 'same-origin') return;
        const url = new URL(e.request.url);
        // Only inject headers on same-origin app files (never intercept huge Hugging Face model downloads)
        if (url.origin !== self.location.origin) return;

        e.respondWith(
            fetch(e.request).then((res) => {
                if (!res || res.status === 0) return res;
                const headers = new Headers(res.headers);
                headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
                headers.set('Cross-Origin-Opener-Policy', 'same-origin');
                return new Response(res.body, {
                    status: res.status,
                    statusText: res.statusText,
                    headers
                });
            }).catch(() => fetch(e.request))
        );
    });
} else if (!window.crossOriginIsolated && 'serviceWorker' in navigator) {
    if (!sessionStorage.getItem('coi_sw_reloaded')) {
        navigator.serviceWorker.register('./coi-serviceworker.js').then((reg) => {
            const doReload = () => {
                sessionStorage.setItem('coi_sw_reloaded', '1');
                window.location.reload();
            };
            if (reg.active && !navigator.serviceWorker.controller) {
                doReload();
            } else if (reg.installing) {
                reg.installing.addEventListener('statechange', (ev) => {
                    if (ev.target.state === 'activated') doReload();
                });
            }
        }).catch(() => {});
    }
} else if (window.crossOriginIsolated) {
    sessionStorage.removeItem('coi_sw_reloaded');
}
