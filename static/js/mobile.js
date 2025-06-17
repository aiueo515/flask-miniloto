/**
 * モバイル最適化機能 - ロト7予測PWA
 * スマホ特有の機能とユーザビリティ向上
 */

class MobileOptimizer {
    constructor() {
        this.isTouch = 'ontouchstart' in window;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        this.isAndroid = /Android/.test(navigator.userAgent);
        this.viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        this.init();
    }
    
    /**
     * 初期化
     */
    init() {
        this.setupViewport();
        this.setupTouchHandling();
        this.setupKeyboardHandling();
        this.setupOrientationHandling();
        this.setupScrollBehavior();
        this.setupPullToRefresh();
        this.setupHapticFeedback();
        this.setupPerformanceOptimization();
        
        if (this.isIOS) {
            this.setupIOSOptimizations();
        }
        
        if (this.isAndroid) {
            this.setupAndroidOptimizations();
        }
    }
    
    /**
     * ビューポート設定
     */
    setupViewport() {
        // 動的ビューポート設定
        this.updateViewportHeight();
        
        // リサイズ時の処理
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.updateViewportHeight();
                this.handleViewportChange();
            }, 150);
        });
        
        // iOS Safari のアドレスバー対応
        if (this.isIOS) {
            window.addEventListener('orientationchange', () => {
                setTimeout(this.updateViewportHeight.bind(this), 500);
            });
        }
    }
    
    /**
     * ビューポート高さの更新
     */
    updateViewportHeight() {
        this.viewport.width = window.innerWidth;
        this.viewport.height = window.innerHeight;
        
        // CSS カスタムプロパティを更新
        document.documentElement.style.setProperty('--vh', `${this.viewport.height * 0.01}px`);
        document.documentElement.style.setProperty('--vw', `${this.viewport.width * 0.01}px`);
    }
    
    /**
     * ビューポート変更時の処理
     */
    handleViewportChange() {
        // モーダルの位置調整
        const modal = document.querySelector('.modal-overlay:not(.hidden)');
        if (modal) {
            this.adjustModalPosition(modal);
        }
        
        // キーボード表示時の処理
        if (this.viewport.height < window.screen.height * 0.7) {
            document.body.classList.add('keyboard-visible');
        } else {
            document.body.classList.remove('keyboard-visible');
        }
    }
    
    /**
     * タッチ操作の設定
     */
    setupTouchHandling() {
        if (!this.isTouch) return;
        
        // タッチイベントの最適化
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
        
        // ダブルタップズーム防止（必要な場合のみ）
        this.preventDoubleTabZoom();
        
        // スワイプジェスチャー
        this.setupSwipeGestures();
        
        // 長押し対応
        this.setupLongPress();
    }
    
    /**
     * タッチ開始処理
     */
    handleTouchStart(event) {
        this.touchStartTime = Date.now();
        this.touchStartPoint = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
        };
        
        // タッチフィードバック
        const target = event.target.closest('.btn, .nav-tab, .history-item');
        if (target) {
            target.classList.add('touch-active');
        }
    }
    
    /**
     * タッチ移動処理
     */
    handleTouchMove(event) {
        // プルトゥリフレッシュの処理
        if (this.isPullToRefreshActive) {
            this.handlePullToRefreshMove(event);
        }
        
        // スワイプ検出
        if (this.touchStartPoint) {
            const currentPoint = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            };
            
            this.detectSwipe(this.touchStartPoint, currentPoint);
        }
    }
    
    /**
     * タッチ終了処理
     */
    handleTouchEnd(event) {
        // タッチフィードバックを削除
        document.querySelectorAll('.touch-active').forEach(el => {
            el.classList.remove('touch-active');
        });
        
        // 長押しタイマーをクリア
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        
        this.touchStartPoint = null;
        this.touchStartTime = null;
    }
    
    /**
     * ダブルタップズーム防止
     */
    preventDoubleTabZoom() {
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (event) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }
    
    /**
     * スワイプジェスチャーの設定
     */
    setupSwipeGestures() {
        this.swipeThreshold = 50; // ピクセル
        this.swipeTimeout = 300; // ミリ秒
    }
    
    /**
     * スワイプ検出
     */
    detectSwipe(startPoint, currentPoint) {
        const deltaX = currentPoint.x - startPoint.x;
        const deltaY = currentPoint.y - startPoint.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > this.swipeThreshold) {
            const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
            
            // 水平スワイプでタブ切り替え
            if (Math.abs(angle) < 30 || Math.abs(angle) > 150) {
                this.handleHorizontalSwipe(deltaX > 0 ? 'right' : 'left');
            }
        }
    }
    
    /**
     * 水平スワイプ処理
     */
    handleHorizontalSwipe(direction) {
        const tabs = ['predict', 'history', 'analysis', 'settings'];
        const currentTab = window.ui ? window.ui.currentTab : 'predict';
        const currentIndex = tabs.indexOf(currentTab);
        
        let newIndex;
        if (direction === 'left' && currentIndex < tabs.length - 1) {
            newIndex = currentIndex + 1;
        } else if (direction === 'right' && currentIndex > 0) {
            newIndex = currentIndex - 1;
        }
        
        if (newIndex !== undefined && window.ui) {
            window.ui.switchTab(tabs[newIndex]);
            this.triggerHapticFeedback('light');
        }
    }
    
    /**
     * 長押し設定
     */
    setupLongPress() {
        document.addEventListener('touchstart', (event) => {
            const target = event.target.closest('.number-ball, .prediction-set');
            if (target) {
                this.longPressTimer = setTimeout(() => {
                    this.handleLongPress(target, event);
                }, 500);
            }
        });
    }
    
    /**
     * 長押し処理
     */
    handleLongPress(target, event) {
        if (target.classList.contains('number-ball')) {
            // 数字ボールの長押し：詳細情報表示
            this.showNumberDetails(target);
        } else if (target.classList.contains('prediction-set')) {
            // 予測セットの長押し：コピー機能
            this.copyPredictionSet(target);
        }
        
        this.triggerHapticFeedback('medium');
    }
    
    /**
     * キーボード処理
     */
    setupKeyboardHandling() {
        // 入力フィールドフォーカス時の処理
        document.addEventListener('focusin', (event) => {
            if (event.target.matches('input, textarea, select')) {
                this.handleInputFocus(event.target);
            }
        });
        
        document.addEventListener('focusout', (event) => {
            if (event.target.matches('input, textarea, select')) {
                this.handleInputBlur(event.target);
            }
        });
    }
    
    /**
     * 入力フィールドフォーカス処理
     */
    handleInputFocus(input) {
        // iOS Safariでのズーム防止
        if (this.isIOS) {
            input.style.fontSize = '16px';
        }
        
        // キーボード表示時のスクロール調整
        setTimeout(() => {
            if (input.getBoundingClientRect().bottom > this.viewport.height) {
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    }
    
    /**
     * 入力フィールドブラー処理
     */
    handleInputBlur(input) {
        // フォントサイズをリセット
        if (this.isIOS) {
            input.style.fontSize = '';
        }
    }
    
    /**
     * 画面向き変更の処理
     */
    setupOrientationHandling() {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });
    }
    
    /**
     * 画面向き変更時の処理
     */
    handleOrientationChange() {
        // レイアウトの再計算
        this.updateViewportHeight();
        
        // 横向き時の最適化
        if (Math.abs(window.orientation) === 90) {
            document.body.classList.add('landscape');
            this.optimizeForLandscape();
        } else {
            document.body.classList.remove('landscape');
            this.optimizeForPortrait();
        }
    }
    
    /**
     * 横向き最適化
     */
    optimizeForLandscape() {
        // ナビゲーションタブのテキストを非表示
        document.body.classList.add('compact-nav');
        
        // モーダルサイズの調整
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.maxHeight = '80vh';
        });
    }
    
    /**
     * 縦向き最適化
     */
    optimizeForPortrait() {
        document.body.classList.remove('compact-nav');
        
        // モーダルサイズをリセット
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.maxHeight = '';
        });
    }
    
    /**
     * スクロール動作の設定
     */
    setupScrollBehavior() {
        // 慣性スクロールの有効化
        document.body.style.webkitOverflowScrolling = 'touch';
        
        // スクロール位置の復元
        this.saveScrollPosition();
        
        // スクロール最適化
        this.setupScrollOptimization();
    }
    
    /**
     * スクロール位置の保存・復元
     */
    saveScrollPosition() {
        window.addEventListener('beforeunload', () => {
            sessionStorage.setItem('scrollPosition', window.pageYOffset.toString());
        });
        
        window.addEventListener('load', () => {
            const savedPosition = sessionStorage.getItem('scrollPosition');
            if (savedPosition) {
                window.scrollTo(0, parseInt(savedPosition));
                sessionStorage.removeItem('scrollPosition');
            }
        });
    }
    
    /**
     * スクロール最適化
     */
    setupScrollOptimization() {
        let isScrolling = false;
        
        window.addEventListener('scroll', () => {
            if (!isScrolling) {
                window.requestAnimationFrame(() => {
                    this.handleScroll();
                    isScrolling = false;
                });
                isScrolling = true;
            }
        }, { passive: true });
    }
    
    /**
     * スクロール処理
     */
    handleScroll() {
        const scrollTop = window.pageYOffset;
        
        // ヘッダーの表示/非表示
        if (scrollTop > 100) {
            document.body.classList.add('scrolled');
        } else {
            document.body.classList.remove('scrolled');
        }
        
        // 上端付近での処理
        if (scrollTop < 10) {
            document.body.classList.add('at-top');
        } else {
            document.body.classList.remove('at-top');
        }
    }
    

/**
     * プルトゥリフレッシュの設定
     */
    setupPullToRefresh() {
        this.isPullToRefreshActive = false;
        this.pullThreshold = 80;
        this.startY = 0;
        this.currentPullDistance = 0;
        
        document.addEventListener('touchstart', (event) => {
            if (window.pageYOffset === 0) {
                this.startY = event.touches[0].clientY;
                this.isPullToRefreshActive = true;
            }
        }, { passive: true });
        
        document.addEventListener('touchmove', (event) => {
            if (this.isPullToRefreshActive) {
                this.handlePullToRefreshMove(event);
            }
        });
        
        document.addEventListener('touchend', () => {
            if (this.isPullToRefreshActive) {
                this.handlePullToRefreshEnd();
            }
        });
    }

// setupPullToRefresh() メソッドの後に以下のメソッドを追加

    /**
     * プルトゥリフレッシュの移動処理
     */
    handlePullToRefreshMove(event) {
        if (!this.isPullToRefreshActive) return;
        
        const currentY = event.touches[0].clientY;
        const pullDistance = currentY - this.startY;
        
        if (pullDistance > 0 && pullDistance < this.pullThreshold * 2) {
            this.updatePullToRefresh(pullDistance);
            
            if (pullDistance > 20) {
                event.preventDefault();
            }
        }
    }
    
    /**
     * プルトゥリフレッシュの更新
     */
    updatePullToRefresh(distance) {
        // プルトゥリフレッシュのインジケーターを更新
        let indicator = document.querySelector('.pull-to-refresh-indicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'pull-to-refresh-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 0;
                left: 50%;
                transform: translateX(-50%) translateY(${Math.min(distance - 20, 60)}px);
                width: 40px;
                height: 40px;
                background: white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                transition: transform 0.2s;
            `;
            indicator.innerHTML = '↓';
            document.body.appendChild(indicator);
        } else {
            indicator.style.transform = `translateX(-50%) translateY(${Math.min(distance - 20, 60)}px)`;
        }
        
        // しきい値を超えたら矢印を回転
        if (distance > this.pullThreshold) {
            indicator.style.transform += ' rotate(180deg)';
        }
        
        // 現在の引っ張り距離を保存
        this.currentPullDistance = distance;
    }
    
    /**
     * プルトゥリフレッシュの終了処理
     */
    handlePullToRefreshEnd() {
        if (!this.isPullToRefreshActive) return;
        
        const indicator = document.querySelector('.pull-to-refresh-indicator');
        if (indicator) {
            indicator.remove();
        }
        
        // リフレッシュ実行
        if (this.currentPullDistance > this.pullThreshold) {
            if (window.ui) {
                window.ui.refreshCurrentTab();
            }
        }
        
        this.isPullToRefreshActive = false;
        this.currentPullDistance = 0;
    }
    
    /**
     * リフレッシュ実行
     */
    triggerRefresh() {
        if (window.ui) {
            window.ui.refreshCurrentTab();
            this.triggerHapticFeedback('medium');
        }
    }
    
    /**
     * プルトゥリフレッシュリセット
     */
    resetPullToRefresh() {
        const indicator = document.querySelector('.pull-to-refresh-indicator');
        if (indicator) {
            indicator.style.transform = '';
            indicator.style.opacity = '';
            indicator.classList.remove('ready');
        }
        
        this.isPullToRefreshActive = false;
        this.currentPullDistance = 0;
    }
    
    /**
     * プルトゥリフレッシュインジケーター取得
     */
    getPullToRefreshIndicator() {
        let indicator = document.getElementById('pull-to-refresh');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'pull-to-refresh';
            indicator.className = 'pull-to-refresh-indicator';
            indicator.innerHTML = '🔄';
            document.body.insertBefore(indicator, document.body.firstChild);
        }
        return indicator;
    }

    
    /**
     * ハプティックフィードバック
     */
    setupHapticFeedback() {
        this.hapticSupported = 'vibrate' in navigator;
    }
    
    /**
     * ハプティックフィードバック実行
     */
    triggerHapticFeedback(type = 'light') {
        if (!this.hapticSupported) return;
        
        const patterns = {
            light: [10],
            medium: [50],
            heavy: [100],
            success: [10, 30, 10],
            error: [100, 50, 100]
        };
        
        const pattern = patterns[type] || patterns.light;
        navigator.vibrate(pattern);
    }
    
    /**
     * パフォーマンス最適化
     */
    setupPerformanceOptimization() {
        // 画像遅延読み込み
        this.setupLazyLoading();
        
        // アニメーション最適化
        this.optimizeAnimations();
        
        // メモリ使用量の監視
        this.monitorPerformance();
    }
    
    /**
     * 遅延読み込み設定
     */
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            observer.unobserve(img);
                        }
                    }
                });
            }, { threshold: 0.1 });
            
            document.querySelectorAll('img[data-src]').forEach(img => {
                observer.observe(img);
            });
        }
    }
    
    /**
     * アニメーション最適化
     */
    optimizeAnimations() {
        // 低スペック端末での簡略化
        if (this.isLowEndDevice()) {
            document.body.classList.add('reduced-animations');
        }
        
        // prefersReducedMotionの尊重
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.body.classList.add('reduced-animations');
        }
    }
    
    /**
     * 低スペック端末の判定
     */
    isLowEndDevice() {
        // メモリ、CPU、接続速度による判定
        const memory = navigator.deviceMemory || 4;
        const cores = navigator.hardwareConcurrency || 4;
        const connection = navigator.connection;
        
        return memory < 4 || cores < 4 || 
               (connection && connection.effectiveType === 'slow-2g');
    }
    
    /**
     * パフォーマンス監視
     */
    monitorPerformance() {
        // メモリ使用量の定期チェック
        if ('memory' in performance) {
            setInterval(() => {
                const memInfo = performance.memory;
                if (memInfo.usedJSHeapSize > memInfo.jsHeapSizeLimit * 0.9) {
                    console.warn('メモリ使用量が高くなっています');
                    this.cleanupMemory();
                }
            }, 30000);
        }
    }
    
    /**
     * メモリクリーンアップ
     */
    cleanupMemory() {
        // 不要な要素の削除
        document.querySelectorAll('.toast').forEach(toast => {
            if (toast.style.opacity === '0') {
                toast.remove();
            }
        });
        
        // ガベージコレクションを促す
        if (window.gc) {
            window.gc();
        }
    }
    
    /**
     * iOS固有の最適化
     */
    setupIOSOptimizations() {
        // Safariのバウンス無効化
        document.body.style.overscrollBehaviorY = 'none';
        
        // ステータスバー対応
        this.setupIOSStatusBar();
        
        // ホームインジケーター対応
        this.setupIOSHomeIndicator();
    }
    
    /**
     * iOSステータスバー対応
     */
    setupIOSStatusBar() {
        const metaStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
        if (!metaStatusBar) {
            const meta = document.createElement('meta');
            meta.name = 'apple-mobile-web-app-status-bar-style';
            meta.content = 'default';
            document.head.appendChild(meta);
        }
    }
    
    /**
     * iOSホームインジケーター対応
     */
    setupIOSHomeIndicator() {
        // セーフエリアの確保
        if (CSS.supports('padding-bottom: env(safe-area-inset-bottom)')) {
            document.body.style.paddingBottom = 'env(safe-area-inset-bottom)';
        }
    }
    
    /**
     * Android固有の最適化
     */
    setupAndroidOptimizations() {
        // 戻るボタン対応
        this.setupAndroidBackButton();
        
        // ナビゲーションバー対応
        this.setupAndroidNavigationBar();
    }
    
    /**
     * Android戻るボタン対応
     */
    setupAndroidBackButton() {
        window.addEventListener('popstate', (event) => {
            // モーダルが開いている場合は閉じる
            const modal = document.querySelector('.modal-overlay:not(.hidden)');
            if (modal && window.ui) {
                event.preventDefault();
                window.ui.hideModal();
                history.pushState(null, '', window.location.href);
            }
        });
        
        // 初期状態をプッシュ
        history.pushState(null, '', window.location.href);
    }
    
    /**
     * Androidナビゲーションバー対応
     */
    setupAndroidNavigationBar() {
        // ナビゲーションバーの色設定
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = '#1890ff';
        }
    }
    
    /**
     * 数字詳細表示
     */
    showNumberDetails(numberBall) {
        const number = parseInt(numberBall.textContent);
        
        if (window.ui) {
            window.ui.showModal(
                `数字 ${number} の詳細`,
                `<p>選択された数字: <strong>${number}</strong></p>
                 <p>この数字の出現頻度や統計情報などを表示できます。</p>`,
                [{ text: '閉じる', class: 'btn-primary' }]
            );
        }
    }
    
    /**
     * 予測セットのコピー
     */
    copyPredictionSet(predictionSet) {
        const numbers = Array.from(predictionSet.querySelectorAll('.number-ball'))
            .map(ball => ball.textContent)
            .join(', ');
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(numbers).then(() => {
                if (window.ui) {
                    window.ui.showToast(`予測をコピーしました: ${numbers}`, 'success');
                }
            });
        }
    }
    
    /**
     * モーダル位置調整
     */
    adjustModalPosition(modal) {
        const modalContent = modal.querySelector('.modal');
        if (modalContent) {
            const rect = modalContent.getBoundingClientRect();
            if (rect.bottom > this.viewport.height) {
                modalContent.style.maxHeight = `${this.viewport.height - 40}px`;
                modalContent.style.overflow = 'auto';
            }
        }
    }
}

// モバイル最適化の初期化
document.addEventListener('DOMContentLoaded', () => {
    window.mobileOptimizer = new MobileOptimizer();
    console.log('モバイル最適化機能を初期化しました');
});