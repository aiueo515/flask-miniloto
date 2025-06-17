/**
 * Service Worker修正版 - mobile.jsとdebug-fix.jsを含める
 */

const CACHE_NAME = 'miniloto-v1-fixed';
const API_CACHE_NAME = 'miniloto-api-v1-fixed';
const CACHE_VERSION = '1.0.1'; // バージョンアップ

// キャッシュするリソース（mobile.jsとdebug-fix.jsを追加）
const STATIC_RESOURCES = [
    '/',
    '/static/css/main.css',
    '/static/css/components.css',
    '/static/css/mobile.css',
    '/static/css/mobile-final.css', // 追加
    '/static/js/api.js',
    '/static/js/ui.js',
    '/static/js/main.js',
    '/static/js/analysis.js',
    '/static/js/pwa.js',
    '/static/js/mobile.js', // 確実にキャッシュに含める
    '/static/js/debug-fix.js', // 新しい緊急デバッグスクリプト
    '/static/icons/icon-192x192.png',
    '/static/icons/icon-512x512.png',
    '/manifest.json'
];

// APIエンドポイント（キャッシュ対象）
const API_ENDPOINTS = [
    '/api/status',
    '/api/recent_results',
    '/api/prediction_history'
];

// キャッシュしないAPIエンドポイント（常に最新データが必要）
const NO_CACHE_APIS = [
    '/api/predict',
    '/api/train',
    '/api/upload',
    '/api/download'
];

/**
 * Service Workerインストール
 */
self.addEventListener('install', (event) => {
    console.log('Service Worker: インストール開始（修正版）');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: 静的リソースをキャッシュ（mobile.js含む）');
                return cache.addAll(STATIC_RESOURCES);
            })
            .then(() => {
                console.log('Service Worker: インストール完了（修正版）');
                // 即座にアクティブ化して古いバージョンを置き換え
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: インストールエラー', error);
                // エラーが発生してもインストール自体は完了させる
                return self.skipWaiting();
            })
    );
});

/**
 * Service Workerアクティベーション
 */
self.addEventListener('activate', (event) => {
    console.log('Service Worker: アクティベーション開始（修正版）');
    
    event.waitUntil(
        Promise.all([
            // 古いキャッシュの削除
            cleanupOldCaches(),
            // 全てのクライアントを即座にコントロール
            self.clients.claim()
        ]).then(() => {
            console.log('Service Worker: アクティベーション完了（修正版）');
            // すべてのクライアントにリロードを通知
            return self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_UPDATED',
                        message: 'Service Worker が更新されました'
                    });
                });
            });
        })
    );
});

/**
 * 古いキャッシュの削除（強化版）
 */
async function cleanupOldCaches() {
    try {
        const cacheNames = await caches.keys();
        console.log('Service Worker: 既存キャッシュ', cacheNames);
        
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
 * フェッチイベント（修正版）
 */
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // 同一オリジンのリクエストのみ処理
    if (url.origin !== location.origin) {
        return;
    }
    
    // デバッグ用：mobile.jsのリクエストをログ出力
    if (url.pathname.includes('mobile.js') || url.pathname.includes('debug-fix.js')) {
        console.log('Service Worker: デバッグ関連ファイルリクエスト', url.pathname);
    }
    
    // APIリクエストの処理
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleAPIRequest(event.request));
        return;
    }
    
    // 静的リソースの処理
    event.respondWith(handleStaticRequest(event.request));
});

/**
 * 静的リソースリクエストの処理（修正版）
 */
async function handleStaticRequest(request) {
    try {
        // キャッシュから取得を試行
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('Service Worker: キャッシュから提供', request.url);
            return cachedResponse;
        }
        
        // キャッシュにない場合はネットワークから取得
        console.log('Service Worker: ネットワークから取得', request.url);
        const networkResponse = await fetch(request);
        
        // 成功した場合はキャッシュに保存
        if (networkResponse.ok && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            await cache.put(request, responseToCache);
            console.log('Service Worker: ネットワークレスポンスをキャッシュ', request.url);
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('Service Worker: リクエスト処理エラー', request.url, error);
        
        // エラー時はキャッシュから再試行
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('Service Worker: エラー時キャッシュフォールバック', request.url);
            return cachedResponse;
        }
        
        // それでもダメな場合は基本的なエラーレスポンス
        if (request.url.endsWith('.js')) {
            return new Response('console.error("ファイル読み込みエラー");', {
                headers: { 'Content-Type': 'application/javascript' }
            });
        }
        
        throw error;
    }
}

/**
 * APIリクエストの処理
 */
async function handleAPIRequest(request) {
    const url = new URL(request.url);
    
    // キャッシュしないAPIの場合は直接ネットワークから取得
    if (NO_CACHE_APIS.some(api => url.pathname.startsWith(api))) {
        try {
            return await fetch(request);
        } catch (error) {
            console.error('Service Worker: API リクエストエラー', error);
            return new Response(JSON.stringify({
                status: 'error',
                message: 'ネットワークエラーが発生しました'
            }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    
    // キャッシュ可能なAPIの場合
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
 * メッセージイベント（クライアントからの通信）
 */
self.addEventListener('message', (event) => {
    console.log('Service Worker: メッセージ受信', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
            version: CACHE_VERSION,
            cacheName: CACHE_NAME
        });
    }
    
    if (event.data && event.data.type === 'FORCE_UPDATE') {
        // 強制更新：すべてのキャッシュをクリアして再取得
        event.waitUntil(
            Promise.all([
                caches.delete(CACHE_NAME),
                caches.delete(API_CACHE_NAME)
            ]).then(() => {
                return caches.open(CACHE_NAME).then(cache => {
                    return cache.addAll(STATIC_RESOURCES);
                });
            }).then(() => {
                // クライアントに更新完了を通知
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'FORCE_UPDATE_COMPLETE',
                            message: 'キャッシュが更新されました'
                        });
                    });
                });
            })
        );
    }
});

/**
 * プッシュイベント（将来の拡張用）
 */
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        console.log('Service Worker: プッシュ通知受信', data);
        
        const options = {
            body: data.body || 'ミニロト予測アプリからの通知',
            icon: '/static/icons/icon-192x192.png',
            badge: '/static/icons/icon-192x192.png',
            tag: 'miniloto-notification',
            requireInteraction: false,
            actions: [
                {
                    action: 'open',
                    title: '開く'
                },
                {
                    action: 'close',
                    title: '閉じる'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(
                data.title || 'ミニロト予測アプリ',
                options
            )
        );
    }
});

/**
 * 通知クリックイベント
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then(clientList => {
                for (const client of clientList) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
        );
    }
});

/**
 * エラーハンドリング
 */
self.addEventListener('error', (event) => {
    console.error('Service Worker: エラー発生', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Service Worker: 未処理のPromise拒否', event.reason);
    event.preventDefault();
});

console.log('Service Worker: 修正版初期化完了', {
    version: CACHE_VERSION,
    cacheName: CACHE_NAME,
    staticResources: STATIC_RESOURCES.length
});