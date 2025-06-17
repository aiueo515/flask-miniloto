/**
 * Service Worker - ロト7予測PWA
 * キャッシュ管理、オフライン対応、バックグラウンド同期
 */

const CACHE_NAME = 'loto7-v1';
const API_CACHE_NAME = 'loto7-api-v1';
const CACHE_VERSION = '1.0.0';

// キャッシュするリソース
const STATIC_RESOURCES = [
    '/',
    '/static/css/main.css',
    '/static/css/components.css',
    '/static/css/mobile.css',
    '/static/js/api.js',
    '/static/js/ui.js',
    '/static/js/main.js',
    '/static/js/analysis.js',
    '/static/js/pwa.js',
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
    console.log('Service Worker: インストール開始');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: 静的リソースをキャッシュ');
                return cache.addAll(STATIC_RESOURCES);
            })
            .then(() => {
                console.log('Service Worker: インストール完了');
                // 即座にアクティブ化
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: インストールエラー', error);
            })
    );
});

/**
 * Service Workerアクティベーション
 */
self.addEventListener('activate', (event) => {
    console.log('Service Worker: アクティベーション開始');
    
    event.waitUntil(
        Promise.all([
            // 古いキャッシュの削除
            cleanupOldCaches(),
            // 全てのクライアントを即座にコントロール
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
    const cacheNames = await caches.keys();
    const validCaches = [CACHE_NAME, API_CACHE_NAME];
    
    const deletePromises = cacheNames
        .filter(cacheName => !validCaches.includes(cacheName))
        .map(cacheName => {
            console.log('Service Worker: 古いキャッシュを削除', cacheName);
            return caches.delete(cacheName);
        });
    
    return Promise.all(deletePromises);
}

/**
 * フェッチイベント処理
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // 同一オリジンのリクエストのみ処理
    if (url.origin !== self.location.origin) {
        return;
    }
    
    // リクエストタイプに応じた処理
    if (url.pathname.startsWith('/api/')) {
        // APIリクエストの処理
        event.respondWith(handleAPIRequest(request));
    } else {
        // 静的リソースの処理
        event.respondWith(handleStaticRequest(request));
    }
});

/**
 * 静的リソースリクエストの処理
 * @param {Request} request - リクエスト
 * @returns {Promise<Response>} レスポンス
 */
async function handleStaticRequest(request) {
    try {
        // Cache First戦略
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            // バックグラウンドで更新をチェック
            updateCacheInBackground(request);
            return cachedResponse;
        }
        
        // キャッシュにない場合はネットワークから取得
        const networkResponse = await fetch(request);
        
        // レスポンスをキャッシュに保存
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('静的リソース取得エラー:', error);
        
        // オフライン時のフォールバック
        if (request.destination === 'document') {
            // HTMLリクエストの場合はメインページを返す
            const cachedIndex = await caches.match('/');
            if (cachedIndex) {
                return cachedIndex;
            }
        }
        
        // その他の場合はオフラインページ
        return createOfflineResponse();
    }
}

/**
 * APIリクエストの処理
 * @param {Request} request - リクエスト
 * @returns {Promise<Response>} レスポンス
 */
async function handleAPIRequest(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // キャッシュしないAPIの場合
    if (NO_CACHE_APIS.some(api => pathname.startsWith(api))) {
        return handleNoCacheAPI(request);
    }
    
    // キャッシュ可能なAPIの場合
    if (API_ENDPOINTS.some(api => pathname.startsWith(api))) {
        return handleCacheableAPI(request);
    }
    
    // その他のAPIリクエスト
    return handleNoCacheAPI(request);
}

/**
 * キャッシュしないAPIの処理
 * @param {Request} request - リクエスト
 * @returns {Promise<Response>} レスポンス
 */
async function handleNoCacheAPI(request) {
    try {
        // Network First戦略
        const networkResponse = await fetch(request);
        return networkResponse;
        
    } catch (error) {
        console.error('API取得エラー:', error);
        
        // オフライン時のレスポンス
        return new Response(
            JSON.stringify({
                status: 'error',
                message: 'オフライン状態です。インターネット接続を確認してください。',
                offline: true
            }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

/**
 * キャッシュ可能なAPIの処理
 * @param {Request} request - リクエスト
 * @returns {Promise<Response>} レスポンス
 */
async function handleCacheableAPI(request) {
    try {
        // Network First, Cache Fallback戦略
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // 成功したレスポンスをキャッシュ
            const cache = await caches.open(API_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('API取得エラー:', error);
        
        // キャッシュからフォールバック
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            // キャッシュデータに古い旨を追加
            const cachedData = await cachedResponse.json();
            const modifiedData = {
                ...cachedData,
                cached: true,
                message: 'オフライン中のため、キャッシュデータを表示しています'
            };
            
            return new Response(JSON.stringify(modifiedData), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // キャッシュもない場合
        return new Response(
            JSON.stringify({
                status: 'error',
                message: 'データを取得できません（オフライン）',
                offline: true
            }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

/**
 * バックグラウンドでキャッシュ更新
 * @param {Request} request - リクエスト
 */
async function updateCacheInBackground(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse);
            console.log('バックグラウンド更新完了:', request.url);
        }
    } catch (error) {
        // バックグラウンド更新の失敗は無視
        console.log('バックグラウンド更新失敗:', request.url);
    }
}

/**
 * オフライン時のレスポンス作成
 * @returns {Response} オフラインレスポンス
 */
function createOfflineResponse() {
    const offlineHTML = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>オフライン - ロト7予測</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    background: #f5f5f5;
                    text-align: center;
                    padding: 20px;
                }
                .offline-icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }
                .offline-title {
                    font-size: 24px;
                    font-weight: 600;
                    margin-bottom: 10px;
                    color: #333;
                }
                .offline-message {
                    font-size: 16px;
                    color: #666;
                    margin-bottom: 30px;
                    line-height: 1.5;
                }
                .retry-button {
                    background: #1890ff;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    font-size: 16px;
                    cursor: pointer;
                }
                .retry-button:hover {
                    background: #40a9ff;
                }
            </style>
        </head>
        <body>
            <div class="offline-icon">📱</div>
            <div class="offline-title">オフライン</div>
            <div class="offline-message">
                インターネット接続を確認してください。<br>
                オフライン中でも一部の機能は利用できます。
            </div>
            <button class="retry-button" onclick="window.location.reload()">
                再試行
            </button>
        </body>
        </html>
    `;
    
    return new Response(offlineHTML, {
        headers: { 'Content-Type': 'text/html' }
    });
}

/**
 * メッセージハンドリング
 */
self.addEventListener('message', (event) => {
    const { data } = event;
    
    if (data && data.type === 'SKIP_WAITING') {
        // 更新をスキップして即座にアクティブ化
        self.skipWaiting();
    }
    
    if (data && data.type === 'GET_VERSION') {
        // バージョン情報を返す
        event.ports[0].postMessage({
            version: CACHE_VERSION,
            cacheName: CACHE_NAME
        });
    }
});

/**
 * バックグラウンド同期（将来の実装用）
 */
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync-predictions') {
        event.waitUntil(syncPredictions());
    }
    
    if (event.tag === 'background-sync-results') {
        event.waitUntil(syncResults());
    }
});

/**
 * 予測データの同期
 */
async function syncPredictions() {
    try {
        console.log('バックグラウンド同期: 予測データ');
        
        // 未送信の予測データがあれば送信
        // 実装は必要に応じて追加
        
    } catch (error) {
        console.error('予測データ同期エラー:', error);
    }
}

/**
 * 結果データの同期
 */
async function syncResults() {
    try {
        console.log('バックグラウンド同期: 結果データ');
        
        // 最新の抽選結果を取得
        const response = await fetch('/api/recent_results?count=1');
        if (response.ok) {
            const data = await response.json();
            
            // 新しい結果があればキャッシュを更新
            const cache = await caches.open(API_CACHE_NAME);
            await cache.put('/api/recent_results?count=5', response.clone());
            
            console.log('結果データ同期完了');
        }
        
    } catch (error) {
        console.error('結果データ同期エラー:', error);
    }
}

/**
 * プッシュ通知処理（将来の実装用）
 */
self.addEventListener('push', (event) => {
    let data = {};
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'ロト7予測', body: event.data.text() };
        }
    }
    
    const options = {
        body: data.body || '新しい情報があります',
        icon: '/static/icons/icon-192x192.png',
        badge: '/static/icons/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: data.data || {},
        actions: [
            {
                action: 'open',
                title: '開く',
                icon: '/static/icons/icon-192x192.png'
            },
            {
                action: 'close',
                title: '閉じる'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'ロト7予測', options)
    );
});

/**
 * 通知クリック処理
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

/**
 * エラーハンドリング
 */
self.addEventListener('error', (event) => {
    console.error('Service Worker エラー:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Service Worker 未処理のPromise拒否:', event.reason);
});

/**
 * キャッシュサイズ管理
 */
async function manageCacheSize() {
    const cache = await caches.open(API_CACHE_NAME);
    const requests = await cache.keys();
    
    // APIキャッシュが100個を超えた場合、古いものを削除
    if (requests.length > 100) {
        const sortedRequests = requests.sort((a, b) => {
            // タイムスタンプでソート（実装は簡略化）
            return a.url.localeCompare(b.url);
        });
        
        // 古い20個を削除
        const toDelete = sortedRequests.slice(0, 20);
        await Promise.all(toDelete.map(request => cache.delete(request)));
        
        console.log('古いAPIキャッシュを削除:', toDelete.length);
    }
}

// 定期的なキャッシュ管理
setInterval(manageCacheSize, 60 * 60 * 1000); // 1時間ごと

console.log('Service Worker: 初期化完了', {
    version: CACHE_VERSION,
    cacheName: CACHE_NAME,
    apiCacheName: API_CACHE_NAME
});