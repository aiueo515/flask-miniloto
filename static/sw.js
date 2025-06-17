/**
 * Service Worker修正版 - HEADリクエスト対応
 * static/sw.js を以下の内容で置き換えてください
 */

const CACHE_NAME = 'miniloto-v2-fixed';
const API_CACHE_NAME = 'miniloto-api-v2-fixed';
const CACHE_VERSION = '2.0.0'; // バージョンアップ

// キャッシュするリソース
const STATIC_RESOURCES = [
    '/',
    '/static/css/main.css',
    '/static/css/components.css',
    '/static/css/mobile.css',
    '/static/css/mobile-final.css',
    '/static/js/api.js',
    '/static/js/ui.js',
    '/static/js/main.js',
    '/static/js/analysis.js',
    '/static/js/pwa.js',
    '/static/js/mobile.js',
    '/static/js/debug-complete.js',
    '/static/icons/icon-192x192.png',
    '/static/icons/icon-512x512.png',
    '/manifest.json'
];

// キャッシュしないAPIエンドポイント（常に最新データが必要）
const NO_CACHE_APIS = [
    '/api/predict',
    '/api/train', 
    '/api/validation',
    '/api/init_heavy',
    '/api/task/',
    '/api/network_test',
    '/api/simple_test',
    '/api/system_debug'
];

/**
 * Service Workerインストール
 */
self.addEventListener('install', (event) => {
    console.log('Service Worker: インストール開始（修正版v2）');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: 静的リソースをキャッシュ');
                return cache.addAll(STATIC_RESOURCES);
            })
            .then(() => {
                console.log('Service Worker: インストール完了');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: インストールエラー', error);
                return self.skipWaiting();
            })
    );
});

/**
 * Service Workerアクティベーション
 */
self.addEventListener('activate', (event) => {
    console.log('Service Worker: アクティベーション開始（修正版v2）');
    
    event.waitUntil(
        Promise.all([
            cleanupOldCaches(),
            self.clients.claim()
        ]).then(() => {
            console.log('Service Worker: アクティベーション完了');
        })
    );
});

/**
 * 古いキャッシュの削除
 */
async function cleanupOldCaches() {
    try {
        const cacheNames = await caches.keys();
        const validCaches = [CACHE_NAME, API_CACHE_NAME];
        
        const deletePromises = cacheNames
            .filter(cacheName => !validCaches.includes(cacheName))
            .map(cacheName => {
                console.log('Service Worker: 古いキャッシュを削除', cacheName);
                return caches.delete(cacheName);
            });
        
        await Promise.all(deletePromises);
        console.log('Service Worker: キャッシュクリーンアップ完了');
    } catch (error) {
        console.error('Service Worker: キャッシュクリーンアップエラー', error);
    }
}

/**
 * フェッチイベント（修正版 - HEADリクエスト対応）
 */
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // 同一オリジンのリクエストのみ処理
    if (url.origin !== location.origin) {
        return;
    }
    
    // === 🔧 HEADリクエストの特別処理 ===
    if (event.request.method === 'HEAD') {
        console.log('Service Worker: HEADリクエスト処理', url.pathname);
        
        event.respondWith(
            handleHEADRequest(event.request)
        );
        return;
    }
    
    // === 🔧 POSTリクエストの特別処理 ===
    if (event.request.method === 'POST') {
        console.log('Service Worker: POSTリクエスト処理', url.pathname);
        
        event.respondWith(
            handlePOSTRequest(event.request)
        );
        return;
    }
    
    // === 🔧 GETリクエストの処理 ===
    if (event.request.method === 'GET') {
        if (url.pathname.startsWith('/api/')) {
            event.respondWith(handleAPIRequest(event.request));
        } else {
            event.respondWith(handleStaticRequest(event.request));
        }
        return;
    }
    
    // その他のメソッド（OPTIONS等）は直接通す
    console.log('Service Worker: その他のメソッド直接通し', event.request.method, url.pathname);
});

/**
 * HEADリクエスト専用処理
 */
async function handleHEADRequest(request) {
    try {
        console.log('Service Worker: HEADリクエスト処理開始', request.url);
        
        // HEADリクエストは直接サーバーに送信
        const response = await fetch(request, {
            method: 'HEAD',
            headers: request.headers,
            mode: 'cors',
            credentials: 'same-origin'
        });
        
        console.log('Service Worker: HEADレスポンス', response.status);
        return response;
        
    } catch (error) {
        console.error('Service Worker: HEADリクエストエラー', error);
        
        // エラー時は簡単なレスポンスを返す
        return new Response('', {
            status: 200,
            statusText: 'OK',
            headers: {
                'Content-Type': 'text/plain',
                'X-SW-Error': 'HEAD request failed',
                'X-SW-Fallback': 'true'
            }
        });
    }
}

/**
 * POSTリクエスト専用処理
 */
async function handlePOSTRequest(request) {
    try {
        console.log('Service Worker: POSTリクエスト処理開始', request.url);
        
        // POSTリクエストは常に直接サーバーに送信（キャッシュしない）
        const response = await fetch(request, {
            method: request.method,
            headers: request.headers,
            body: request.body,
            mode: 'cors',
            credentials: 'same-origin'
        });
        
        console.log('Service Worker: POSTレスポンス', response.status);
        return response;
        
    } catch (error) {
        console.error('Service Worker: POSTリクエストエラー', error);
        
        // エラー時はエラーレスポンスを返す
        return new Response(JSON.stringify({
            status: 'error',
            message: 'ネットワークエラーが発生しました',
            sw_error: true
        }), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
                'Content-Type': 'application/json',
                'X-SW-Error': 'POST request failed'
            }
        });
    }
}

/**
 * APIリクエスト処理（GET専用）
 */
async function handleAPIRequest(request) {
    const url = new URL(request.url);
    
    // キャッシュしないAPIかチェック
    const shouldNotCache = NO_CACHE_APIS.some(api => url.pathname.startsWith(api));
    
    if (shouldNotCache) {
        // キャッシュしないAPIは直接通す
        console.log('Service Worker: APIリクエスト直接通し', url.pathname);
        
        try {
            return await fetch(request);
        } catch (error) {
            console.error('Service Worker: API直接リクエストエラー', error);
            return new Response(JSON.stringify({
                status: 'error',
                message: 'ネットワークエラーです'
            }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    
    // キャッシュ可能なAPIの処理
    try {
        const cache = await caches.open(API_CACHE_NAME);
        
        // まずネットワークから取得を試行
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            await cache.put(request, responseToCache);
            return networkResponse;
        }
        
        throw new Error(`HTTP ${networkResponse.status}`);
        
    } catch (error) {
        console.error('Service Worker: API ネットワークエラー', error);
        
        // ネットワークエラー時はキャッシュから取得
        const cache = await caches.open(API_CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('Service Worker: API キャッシュフォールバック');
            return cachedResponse;
        }
        
        // キャッシュもない場合はエラーレスポンス
        return new Response(JSON.stringify({
            status: 'error',
            message: 'オフライン状態のため、データを取得できません'
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * 静的リソースリクエスト処理
 */
async function handleStaticRequest(request) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            await cache.put(request, responseToCache);
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('Service Worker: 静的リソースエラー', error);
        
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return new Response('Service Worker Error', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

/**
 * メッセージハンドラー
 */
self.addEventListener('message', (event) => {
    console.log('Service Worker: メッセージ受信', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('Service Worker: 修正版v2読み込み完了', {
    version: CACHE_VERSION,
    cacheName: CACHE_NAME
});