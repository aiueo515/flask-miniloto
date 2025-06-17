// UI クラスが確実に読み込まれるまで待機する関数（改良版）
function waitForUI() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 100; // 最大100回試行（5秒）
        const interval = 50; // 50msごと
        
        function checkUI() {
            attempts++;
            
            if (window.UI && typeof window.UI === 'function') {
                console.log('✅ UI クラスの読み込み確認');
                resolve(true);
                return;
            }
            
            if (attempts >= maxAttempts) {
                console.error('❌ UI クラスの読み込みタイムアウト');
                reject(new Error('UI class loading timeout'));
                return;
            }
            
            // 進捗を少なく表示（10回に1回のみ）
            if (attempts % 10 === 0) {
                console.log(`⏳ UI クラスの読み込み待機中... (${attempts}/${maxAttempts})`);
            }
            
            setTimeout(checkUI, interval);
        }
        
        checkUI();
    });
}

/**
 * アプリケーションクラス
 */
class App {
    constructor() {
        this.initialized = false;
        this.isLoading = false;
    }
    
    /**
     * アプリケーション初期化
     */
    async initialize() {
        try {
            console.log('アプリケーション初期化開始...');
            
            // UIクラスの読み込み待機（タイムアウト付き）
            try {
                await waitForUI();
            } catch (error) {
                console.error('UI クラス読み込み失敗:', error.message);
                // UIクラスがない場合の緊急対処
                this.handleUILoadingFailure();
                return;
            }
            
            // APIの存在確認
            if (!window.api || typeof window.api.getSystemStatus !== 'function') {
                throw new Error('API が正しく初期化されていません');
            }
            
            // PWA登録
            if (window.pwa && typeof window.pwa.init === 'function') {
                await window.pwa.init();
            }
            
            // システム状態確認（初回のみ実行）
            if (!this.initialized) {
                await this.checkSystemStatus();
                this.initialized = true;
            }
            
            // UIインスタンス作成（UIクラスが確実に存在することを確認後）
            if (!window.ui && window.UI) {
                window.ui = new window.UI();
                console.log('✅ UI インスタンス作成完了');
            }
            
            // 初期タブの読み込み（初回のみ実行）
            if (window.ui && typeof window.ui.initTab === 'function') {
                await window.ui.initTab('predict');
            }
            
            console.log('✅ アプリケーション初期化完了');
            
        } catch (error) {
            console.error('❌ アプリケーション初期化エラー:', error);
            this.handleInitializationError(error);
        }
    }
    
    /**
     * UI読み込み失敗時の緊急対処
     */
    handleUILoadingFailure() {
        console.warn('⚠️ UIクラスなしで緊急起動モード');
        
        // 基本的なエラー表示
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff4444;
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            z-index: 9999;
        `;
        errorDiv.innerHTML = `
            <h3>⚠️ システムエラー</h3>
            <p>UI.jsファイルの読み込みに失敗しました</p>
            <button onclick="location.reload()" style="
                background: white;
                color: #ff4444;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin-top: 10px;
            ">ページを再読み込み</button>
        `;
        
        document.body.appendChild(errorDiv);
    }
    
    /**
     * 初期化エラー処理
     */
    handleInitializationError(error) {
        // 簡単なエラー表示（UIクラスに依存しない）
        const errorToast = document.createElement('div');
        errorToast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 15px;
            border-radius: 5px;
            z-index: 9999;
            max-width: 300px;
        `;
        errorToast.textContent = `初期化エラー: ${error.message}`;
        
        document.body.appendChild(errorToast);
        
        // 5秒後に自動削除
        setTimeout(() => {
            if (errorToast.parentNode) {
                errorToast.parentNode.removeChild(errorToast);
            }
        }, 5000);
    }
    
    /**
     * システム状態確認
     */
    async checkSystemStatus() {
        try {
            const status = await window.api.getSystemStatus();
            
            if (status.status === 'success' && status.data) {
                if (status.data.system_initialized) {
                    console.log('✅ システムは正常に初期化されています');
                } else {
                    console.warn('⚠️ システムが初期化されていません');
                }
            }
        } catch (error) {
            console.error('❌ システム状態確認エラー:', error);
            // エラーでも処理を続行
        }
    }
}

// グローバルアプリインスタンス
window.app = new App();

// UI クラスの機能拡張（UIクラスが存在する場合のみ）
function extendUIClass() {
    if (!window.UI || !window.UI.prototype) {
        console.warn('⚠️ UI クラスが見つかりません。拡張をスキップします。');
        return;
    }
    
    // UI クラスの機能実装を拡張
    Object.assign(window.UI.prototype, {
        
        /**
         * タブ切り替え（修正版）
         * @param {string} tabName - タブ名
         */
        switchTab(tabName) {
            // 同じタブへの切り替えは無視
            if (this.currentTab === tabName) {
                return;
            }
            
            // アクティブタブの更新
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === tabName);
            });
            
            // コンテンツの切り替え
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.toggle('active', content.id === `${tabName}-tab`);
            });
            
            this.currentTab = tabName;
            
            // タブごとの初期化処理（更新通知なし）
            this.initTab(tabName, false);
        },
        
        /**
         * タブ初期化（修正版）
         * @param {string} tabName - タブ名
         * @param {boolean} showUpdateToast - 更新通知を表示するか
         */
        async initTab(tabName, showUpdateToast = false) {
            // 既に読み込み中の場合はスキップ
            if (this.isLoadingTab) {
                return;
            }
            
            this.isLoadingTab = true;
            
            try {
                switch (tabName) {
                    case 'predict':
                        await this.loadSystemStatus();
                        await this.loadPrediction();
                        break;
                    case 'history':
                        await this.loadPredictionHistory();
                        break;
                    case 'analysis':
                        await this.loadAnalysisData();
                        break;
                    case 'settings':
                        this.updateSettingsUI();
                        break;
                }
                
                if (showUpdateToast) {
                    this.showToast('更新完了', 'success');
                }
            } catch (error) {
                console.error(`タブ初期化エラー (${tabName}):`, error);
                this.showToast(`${tabName}タブの読み込みに失敗しました`, 'error');
            } finally {
                this.isLoadingTab = false;
            }
        }
    });
    
    console.log('✅ UI クラス拡張完了');
}

// DOM読み込み完了後に実行
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📱 DOM読み込み完了');
    
    // タイムアウト付きで初期化実行
    try {
        // UIクラスが読み込まれるまで待機（最大5秒）
        await Promise.race([
            waitForUI(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 5000)
            )
        ]);
        
        // UIクラスを拡張
        extendUIClass();
        
        // アプリケーション初期化
        await window.app.initialize();
        
    } catch (error) {
        console.error('❌ 初期化タイムアウトまたはエラー:', error.message);
        window.app.handleUILoadingFailure();
    }
});

// モバイルデバッグコンソール（スマートフィルタリング版）
class MobileDebugConsole {
    constructor() {
        this.logs = [];
        this.maxLogs = 500; // 十分な容量に拡大
        this.logCount = 0;
        this.spamFilter = new Map(); // スパムフィルター
        this.autoScroll = true;
        this.init();
    }
    
    init() {
        this.createPanel();
        this.interceptConsole();
        this.interceptErrors();
        console.log('📱 モバイルデバッグシステムが起動しました（スマートフィルター版）');
        console.log('🎛️ スパムフィルター: 同一ログは30秒間隔で制限');
        console.log('📊 ログ容量: 500件まで保持');
    }
    }
    
    createPanel() {
        this.panel = document.createElement('div');
        this.panel.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            right: 10px;
            bottom: 10px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px;
            border-radius: 10px;
            z-index: 999999;
            display: none;
            flex-direction: column;
            font-family: monospace;
            font-size: 12px;
        `;
        
        this.panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin: 0; color: #4CAF50;">📱 モバイルデバッグ（スマートフィルター版）</h3>
                <div>
                    <button onclick="window.mobileDebug.toggleAutoScroll()" id="auto-scroll-btn" style="margin-right: 5px; padding: 3px 8px; background: #4CAF50; border: none; border-radius: 3px; color: white; font-size: 10px;">自動スクロール</button>
                    <button onclick="window.mobileDebug.toggleSpamFilter()" id="spam-filter-btn" style="margin-right: 5px; padding: 3px 8px; background: #2196F3; border: none; border-radius: 3px; color: white; font-size: 10px;">スパムフィルター</button>
                    <button onclick="window.mobileDebug.clear()" style="margin-right: 5px; padding: 5px 10px; background: #FF9800; border: none; border-radius: 5px; color: white;">クリア</button>
                    <button onclick="window.systemChecker.runDiagnostics()" style="margin-right: 5px; padding: 5px 10px; background: #2196F3; border: none; border-radius: 5px; color: white;">診断</button>
                    <button onclick="window.mobileDebug.hide()" style="padding: 5px 10px; background: #f44336; border: none; border-radius: 5px; color: white;">×</button>
                </div>
            </div>
            <div id="mobile-logs" style="flex: 1; overflow-y: auto; background: #111; padding: 10px; border-radius: 5px;"></div>
            <div style="margin-top: 10px; font-size: 10px; color: #888; display: flex; justify-content: space-between;">
                <span>ログ: <span id="log-count">0</span>件 / スパム除外: <span id="spam-count">0</span>件</span>
                <span id="filter-status">フィルター: ON</span>
            </div>
        `;
        
        document.body.appendChild(this.panel);
        this.logsContainer = this.panel.querySelector('#mobile-logs');
        this.logCountEl = this.panel.querySelector('#log-count');
        this.spamCountEl = this.panel.querySelector('#spam-count');
        this.filterStatusEl = this.panel.querySelector('#filter-status');
        this.spamFilterEnabled = true;
        this.spamCount = 0;
        
        // デバッグボタン追加
        this.addDebugButton();
    }
    
    addDebugButton() {
        const button = document.createElement('button');
        button.innerHTML = '🐛';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 25px;
            background: #4CAF50;
            border: none;
            color: white;
            font-size: 20px;
            z-index: 999998;
            cursor: pointer;
        `;
        button.onclick = () => this.toggle();
        document.body.appendChild(button);
    }
    
    interceptConsole() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        const originalInfo = console.info;
        
        console.log = (...args) => {
            originalLog.apply(console, args);
            this.addLogWithFilter('log', args);
        };
        
        console.error = (...args) => {
            originalError.apply(console, args);
            this.addLogWithFilter('error', args);
        };
        
        console.warn = (...args) => {
            originalWarn.apply(console, args);
            this.addLogWithFilter('warn', args);
        };
        
        console.info = (...args) => {
            originalInfo.apply(console, args);
            this.addLogWithFilter('info', args);
        };
    }
    
    interceptErrors() {
        window.addEventListener('error', (event) => {
            this.addLog('error', [
                `Error: ${event.message}`,
                `File: ${event.filename}`,
                `Line: ${event.lineno}:${event.colno}`
            ]);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.addLog('error', ['Unhandled Promise Rejection:', event.reason]);
        });
    }
    
    addLogWithFilter(type, args) {
        const message = args.join(' ');
        
        // スパムフィルターが有効な場合
        if (this.spamFilterEnabled) {
            // スパムパターンを定義
            const spamPatterns = [
                'UI クラスの読み込み待機中',
                'UI クラス待機中',
                'analysis.js: UI クラス待機中'
            ];
            
            // スパムパターンにマッチするかチェック
            const isSpam = spamPatterns.some(pattern => message.includes(pattern));
            
            if (isSpam) {
                // スパムログの頻度制限（同じメッセージは30秒に1回のみ表示）
                const spamKey = message.substring(0, 50); // メッセージの最初の50文字をキーに
                const now = Date.now();
                const lastTime = this.spamFilter.get(spamKey) || 0;
                
                if (now - lastTime < 30000) { // 30秒以内
                    this.spamCount++;
                    this.updateSpamCount();
                    return; // スパムとして除外
                }
                
                this.spamFilter.set(spamKey, now);
            }
        }
        
        // 通常のログ追加
        this.addLog(type, args);
    }
    
    addLog(type, args) {
        const timestamp = new Date().toLocaleTimeString('ja-JP');
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
        
        const log = { timestamp, type, message };
        this.logs.push(log);
        this.logCount++;
        
        // ログ数が多くなりすぎた場合のみ古いものを削除
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        this.updateDisplay();
    }
    
    updateDisplay() {
        if (!this.logsContainer) return;
        
        const html = this.logs.map(log => {
            const color = {
                log: '#fff',
                error: '#ff5252',
                warn: '#ff9800',
                info: '#03a9f4'
            }[log.type] || '#fff';
            
            return `
                <div style="margin-bottom: 5px; color: ${color};">
                    <span style="color: #888;">[${log.timestamp}]</span>
                    <span style="color: ${color};">[${log.type.toUpperCase()}]</span>
                    <span>${this.escapeHtml(log.message)}</span>
                </div>
            `;
        }).join('');
        
        this.logsContainer.innerHTML = html;
        
        // 自動スクロール
        if (this.autoScroll) {
            this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
        }
        
        // ログ数更新
        if (this.logCountEl) {
            this.logCountEl.textContent = this.logs.length;
        }
    }
    
    updateSpamCount() {
        if (this.spamCountEl) {
            this.spamCountEl.textContent = this.spamCount;
        }
    }
    
    toggleSpamFilter() {
        this.spamFilterEnabled = !this.spamFilterEnabled;
        const btn = document.getElementById('spam-filter-btn');
        const status = document.getElementById('filter-status');
        
        if (this.spamFilterEnabled) {
            btn.style.background = '#2196F3';
            btn.textContent = 'スパムフィルター';
            status.textContent = 'フィルター: ON';
            status.style.color = '#4CAF50';
        } else {
            btn.style.background = '#FF5722';
            btn.textContent = 'フィルター無効';
            status.textContent = 'フィルター: OFF';
            status.style.color = '#FF5722';
        }
    }
    
    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        const btn = document.getElementById('auto-scroll-btn');
        
        if (this.autoScroll) {
            btn.style.background = '#4CAF50';
            btn.textContent = '自動スクロール';
        } else {
            btn.style.background = '#FF5722';
            btn.textContent = '手動スクロール';
        }
    }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    show() {
        this.panel.style.display = 'flex';
    }
    
    hide() {
        this.panel.style.display = 'none';
    }
    
    toggle() {
        if (this.panel.style.display === 'none') {
            this.show();
        } else {
            this.hide();
        }
    }
    
    clear() {
        this.logs = [];
        this.spamCount = 0;
        this.spamFilter.clear();
        this.updateDisplay();
        this.updateSpamCount();
    }
}

// システム診断クラス
class SystemStatusChecker {
    async runDiagnostics() {
        console.log('=== システム診断開始 ===');
        
        try {
            // 1. API接続テスト
            console.log('1. API接続テスト...');
            const response = await fetch('/?api=true');
            const data = await response.json();
            console.log('✅ API接続: OK', data);
        } catch (error) {
            console.error('❌ API接続: エラー', error.message);
        }
        
        try {
            // 2. システム初期化状態
            console.log('2. システム初期化状態...');
            const status = await window.api.getSystemStatus();
            console.log('✅ システム状態取得: OK', status);
        } catch (error) {
            console.error('❌ システム状態取得: エラー', error.message);
        }
        
        // 3. UI状態確認
        console.log('3. UI状態確認...');
        console.log('UI クラス:', typeof window.UI);
        console.log('ui インスタンス:', typeof window.ui);
        console.log('現在のタブ:', window.ui ? window.ui.currentTab : 'N/A');
        
        console.log('=== システム診断完了 ===');
    }
}

// グローバルに公開
window.mobileDebug = new MobileDebugConsole();
window.systemChecker = new SystemStatusChecker();