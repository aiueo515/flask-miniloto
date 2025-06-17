/**
 * PWA機能実装 - ロト7予測PWA
 * Service Worker登録、インストール、オフライン対応
 */

class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.swRegistration = null;
        
        this.init();
    }
    
    /**
     * 初期化
     */
    async init() {
        // Service Worker登録
        await this.registerServiceWorker();
        
        // インストール機能の設定
        this.setupInstallFeature();
        
        // PWA状態の確認
        this.checkPWAStatus();
        
        // 更新チェック
        this.setupUpdateCheck();
    }
    
    /**
     * Service Worker登録
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                console.log('Service Worker登録開始...');
                
                this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                });
                
                console.log('Service Worker登録成功:', this.swRegistration.scope);
                
                // Service Workerの状態監視
                this.swRegistration.addEventListener('updatefound', () => {
                    console.log('新しいService Workerが見つかりました');
                    this.handleServiceWorkerUpdate();
                });
                
                // アクティブなService Workerの状態変更監視
                if (this.swRegistration.active) {
                    this.swRegistration.active.addEventListener('statechange', (event) => {
                        console.log('Service Worker状態変更:', event.target.state);
                    });
                }
                
            } catch (error) {
                console.error('Service Worker登録失敗:', error);
            }
        } else {
            console.warn('Service Workerはサポートされていません');
        }
    }
    
    /**
     * Service Worker更新処理
     */
    handleServiceWorkerUpdate() {
        const newWorker = this.swRegistration.installing;
        
        newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 新しいバージョンが利用可能
                this.showUpdateAvailable();
            }
        });
    }
    
    /**
     * 更新通知の表示
     */
    showUpdateAvailable() {
        if (window.ui) {
            const updateButton = {
                text: '更新',
                class: 'btn-primary',
                handler: () => {
                    this.applyUpdate();
                    window.ui.hideModal();
                }
            };
            
            const laterButton = {
                text: '後で',
                class: 'btn-secondary',
                handler: () => window.ui.hideModal()
            };
            
            window.ui.showModal(
                'アプリ更新',
                '<p>新しいバージョンが利用可能です。更新しますか？</p>',
                [laterButton, updateButton]
            );
        }
    }
    
    /**
     * 更新の適用
     */
    async applyUpdate() {
        if (this.swRegistration && this.swRegistration.waiting) {
            // 待機中のService Workerにメッセージを送信
            this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
            
            // ページリロード
            window.location.reload();
        }
    }
    
    /**
     * インストール機能の設定
     */
    setupInstallFeature() {
        // beforeinstallpromptイベントの監視
        window.addEventListener('beforeinstallprompt', (event) => {
            console.log('インストールプロンプト準備完了');
            
            // ブラウザのデフォルトプロンプトを防止
            event.preventDefault();
            
            // プロンプトを保存
            this.deferredPrompt = event;
            
            // インストールバナーを表示
            this.showInstallBanner();
        });
        
        // インストール完了イベント
        window.addEventListener('appinstalled', (event) => {
            console.log('PWAがインストールされました');
            this.isInstalled = true;
            this.hideInstallBanner();
            
            if (window.ui) {
                window.ui.showToast('アプリがインストールされました！', 'success');
            }
        });
        
        // インストールボタンのイベント
        const installBtn = document.getElementById('install-btn');
        const dismissBtn = document.getElementById('install-dismiss');
        
        if (installBtn) {
            installBtn.addEventListener('click', () => this.installApp());
        }
        
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => this.hideInstallBanner());
        }
    }
    
    /**
     * インストールバナーの表示
     */
    showInstallBanner() {
        const banner = document.getElementById('install-banner');
        if (banner && !this.isInstalled) {
            banner.classList.remove('hidden');
            
            // バナーを数秒後に自動で表示
            setTimeout(() => {
                banner.style.animation = 'slideInUp 0.5s ease-out';
            }, 1000);
        }
    }
    
    /**
     * インストールバナーの非表示
     */
    hideInstallBanner() {
        const banner = document.getElementById('install-banner');
        if (banner) {
            banner.style.animation = 'slideOutDown 0.5s ease-in-out';
            setTimeout(() => {
                banner.classList.add('hidden');
            }, 500);
        }
    }
    
    /**
     * アプリのインストール
     */
    async installApp() {
        if (!this.deferredPrompt) {
            console.warn('インストールプロンプトが利用できません');
            return;
        }
        
        try {
            // インストールプロンプトを表示
            this.deferredPrompt.prompt();
            
            // ユーザーの選択を待機
            const { outcome } = await this.deferredPrompt.userChoice;
            
            console.log('インストール選択結果:', outcome);
            
            if (outcome === 'accepted') {
                console.log('ユーザーがインストールを承認');
            } else {
                console.log('ユーザーがインストールを拒否');
            }
            
            // プロンプトをクリア
            this.deferredPrompt = null;
            
            // バナーを非表示
            this.hideInstallBanner();
            
        } catch (error) {
            console.error('インストールエラー:', error);
            
            if (window.ui) {
                window.ui.showToast('インストールに失敗しました', 'error');
            }
        }
    }
    
    /**
     * PWA状態の確認
     */
    checkPWAStatus() {
        // スタンドアロンモードで実行されているかチェック
        if (window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone === true) {
            console.log('PWAモードで実行中');
            this.isInstalled = true;
            this.hideInstallBanner();
        }
        
        // PWA機能のサポート状況をチェック
        this.checkPWAFeatureSupport();
    }
    
    /**
     * PWA機能サポート状況のチェック
     */
    checkPWAFeatureSupport() {
        const features = {
            serviceWorker: 'serviceWorker' in navigator,
            notifications: 'Notification' in window,
            cacheAPI: 'caches' in window,
            indexedDB: 'indexedDB' in window,
            webShare: 'share' in navigator,
            badging: 'setAppBadge' in navigator
        };
        
        console.log('PWA機能サポート状況:', features);
        
        // サポートされていない機能の警告
        if (!features.serviceWorker) {
            console.warn('Service Workerがサポートされていません');
        }
        
        if (!features.cacheAPI) {
            console.warn('Cache APIがサポートされていません');
        }
    }
    
    /**
     * 更新チェックの設定
     */
    setupUpdateCheck() {
        // 定期的な更新チェック（1時間ごと）
        setInterval(() => {
            this.checkForUpdates();
        }, 60 * 60 * 1000);
        
        // アプリがフォーカスを取得した時の更新チェック
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkForUpdates();
            }
        });
    }
    
    /**
     * 更新チェック
     */
    async checkForUpdates() {
        if (this.swRegistration) {
            try {
                await this.swRegistration.update();
                console.log('更新チェック完了');
            } catch (error) {
                console.error('更新チェックエラー:', error);
            }
        }
    }
    
    /**
     * キャッシュ管理
     */
    async manageCaches() {
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                console.log('利用可能なキャッシュ:', cacheNames);
                
                // 古いキャッシュの削除
                const currentCaches = ['loto7-v1', 'loto7-api-v1'];
                const cachesToDelete = cacheNames.filter(
                    cacheName => !currentCaches.includes(cacheName)
                );
                
                await Promise.all(
                    cachesToDelete.map(cacheName => caches.delete(cacheName))
                );
                
                if (cachesToDelete.length > 0) {
                    console.log('古いキャッシュを削除:', cachesToDelete);
                }
            } catch (error) {
                console.error('キャッシュ管理エラー:', error);
            }
        }
    }
    
    /**
     * オフライン状態の処理
     */
    handleOfflineStatus() {
        const showOfflineToast = () => {
            if (window.ui) {
                window.ui.showToast(
                    'オフラインモードです。一部機能が制限されます。',
                    'warning',
                    0
                );
            }
        };
        
        const showOnlineToast = () => {
            if (window.ui) {
                window.ui.showToast('オンラインに復帰しました！', 'success');
            }
        };
        
        // 初期状態
        if (!navigator.onLine) {
            setTimeout(showOfflineToast, 1000);
        }
        
        // オンライン/オフライン状態の監視
        window.addEventListener('online', showOnlineToast);
        window.addEventListener('offline', showOfflineToast);
    }
    
    /**
     * 通知機能の設定
     */
    async setupNotifications() {
        if ('Notification' in window) {
            // 通知許可の確認
            if (Notification.permission === 'default') {
                // 初回は許可を求めない（ユーザーが設定で有効にした時のみ）
                console.log('通知許可: 未設定');
            } else if (Notification.permission === 'granted') {
                console.log('通知許可: 許可済み');
                this.enableNotifications();
            } else {
                console.log('通知許可: 拒否済み');
            }
        }
    }
    
    /**
     * 通知の有効化
     */
    enableNotifications() {
        // Service Workerでの通知機能を有効化
        if (this.swRegistration) {
            // プッシュ通知の設定（将来の実装用）
            console.log('通知機能が有効化されました');
        }
    }
    
    /**
     * Web Share API
     */
    async shareApp() {
        if ('share' in navigator) {
            try {
                await navigator.share({
                    title: 'ロト7予測アプリ',
                    text: 'AI機械学習による高精度なロト7予測アプリ',
                    url: window.location.href
                });
                console.log('共有完了');
            } catch (error) {
                console.error('共有エラー:', error);
            }
        } else {
            // フォールバック: URLをクリップボードにコピー
            try {
                await navigator.clipboard.writeText(window.location.href);
                if (window.ui) {
                    window.ui.showToast('URLをクリップボードにコピーしました', 'success');
                }
            } catch (error) {
                console.error('クリップボードコピーエラー:', error);
            }
        }
    }
    
    /**
     * パフォーマンス最適化
     */
    optimizePerformance() {
        // Critical Resource Hintsの設定
        this.addResourceHints();
        
        // 画像の遅延読み込み
        this.setupLazyLoading();
        
        // フォントの最適化
        this.optimizeFonts();
    }
    
    /**
     * Resource Hintsの追加
     */
    addResourceHints() {
        const hints = [
            { rel: 'dns-prefetch', href: '//fonts.googleapis.com' },
            { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true }
        ];
        
        hints.forEach(hint => {
            const link = document.createElement('link');
            Object.keys(hint).forEach(key => {
                link[key] = hint[key];
            });
            document.head.appendChild(link);
        });
    }
    
    /**
     * 遅延読み込みの設定
     */
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        observer.unobserve(img);
                    }
                });
            });
            
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }
    
    /**
     * フォント最適化
     */
    optimizeFonts() {
        // Font Display Swapの設定
        if ('fonts' in document) {
            document.fonts.ready.then(() => {
                console.log('フォント読み込み完了');
            });
        }
    }
    
    /**
     * デバッグ情報の取得
     */
    getDebugInfo() {
        return {
            isInstalled: this.isInstalled,
            swRegistered: !!this.swRegistration,
            swScope: this.swRegistration?.scope,
            swState: this.swRegistration?.active?.state,
            isOnline: navigator.onLine,
            supportedFeatures: {
                serviceWorker: 'serviceWorker' in navigator,
                notifications: 'Notification' in window,
                cacheAPI: 'caches' in window,
                webShare: 'share' in navigator,
                clipboard: 'clipboard' in navigator
            }
        };
    }
}

// グローバルPWAマネージャー
window.pwa = new PWAManager();

// DOMContentLoaded後に初期化
document.addEventListener('DOMContentLoaded', () => {
    // オフライン状態の処理を開始
    window.pwa.handleOfflineStatus();
    
    // 通知機能の設定
    window.pwa.setupNotifications();
    
    // パフォーマンス最適化
    window.pwa.optimizePerformance();
    
    // 定期的なキャッシュ管理
    setTimeout(() => {
        window.pwa.manageCaches();
    }, 5000);
});

// アプリ共有機能をグローバルに公開
window.shareApp = () => {
    if (window.pwa) {
        window.pwa.shareApp();
    }
};

// デバッグ情報をグローバルに公開
window.getPWADebugInfo = () => {
    return window.pwa ? window.pwa.getDebugInfo() : null;
};