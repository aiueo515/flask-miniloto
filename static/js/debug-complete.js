/**
 * 完全統合デバッグシステム for ミニロト予測アプリ
 * static/js/debug-complete.js として保存してください
 */

console.log('🔧 完全統合デバッグシステム読み込み開始...');

// ===== 1. 緊急デバッグシステム =====
class EmergencyDebugSystem {
    constructor() {
        this.logs = [];
        this.maxLogs = 200;
        this.isVisible = false;
        this.spamFilter = new Map();
        this.spamTimeout = 5000; // 5秒間は同じログを表示しない
        
        console.log('📱 緊急デバッグシステム初期化開始...');
        this.init();
    }
    
    init() {
        this.createDebugInterface();
        this.setupConsoleInterception();
        this.setupErrorHandling();
        this.setupSystemMonitoring();
        
        console.log('✅ 緊急デバッグシステム初期化完了');
        this.addLog('緊急デバッグシステムが起動しました', 'success');
    }
    
    createDebugInterface() {
        // デバッグパネル作成
        this.panel = document.createElement('div');
        this.panel.id = 'emergency-debug-panel';
        this.panel.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            right: 10px;
            bottom: 10px;
            background: linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.95));
            color: white;
            padding: 15px;
            border-radius: 12px;
            z-index: 999999;
            display: none;
            flex-direction: column;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.8);
            border: 1px solid rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
        `;
        
        this.panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.2);">
                <div>
                    <h3 style="margin: 0; color: #00ff88; font-size: 16px;">🚀 ミニロト緊急デバッグシステム</h3>
                    <div style="font-size: 10px; color: #888; margin-top: 2px;">
                        <span id="debug-status">状態: 準備完了</span> | 
                        <span id="debug-time">${new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button onclick="window.emergencyDebug.runQuickDiag()" style="padding: 4px 8px; background: #2196F3; border: none; border-radius: 4px; color: white; font-size: 10px; cursor: pointer;">クイック診断</button>
                    <button onclick="window.emergencyDebug.runFullDiag()" style="padding: 4px 8px; background: #4CAF50; border: none; border-radius: 4px; color: white; font-size: 10px; cursor: pointer;">完全診断</button>
                    <button onclick="window.emergencyDebug.clearLogs()" style="padding: 4px 8px; background: #FF9800; border: none; border-radius: 4px; color: white; font-size: 10px; cursor: pointer;">クリア</button>
                    <button onclick="window.emergencyDebug.exportLogs()" style="padding: 4px 8px; background: #9C27B0; border: none; border-radius: 4px; color: white; font-size: 10px; cursor: pointer;">エクスポート</button>
                    <button onclick="window.emergencyDebug.hide()" style="padding: 4px 8px; background: #f44336; border: none; border-radius: 4px; color: white; font-size: 10px; cursor: pointer;">×</button>
                </div>
            </div>
            
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <div style="flex: 1;">
                    <div style="font-size: 10px; color: #888; margin-bottom: 5px;">システム状態</div>
                    <div id="system-status" style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; font-size: 10px;">
                        <div>📊 ログ数: <span id="log-count">0</span></div>
                        <div>🔗 接続: <span id="connection-status">${navigator.onLine ? 'オンライン' : 'オフライン'}</span></div>
                        <div>📱 画面: <span id="screen-info">${window.innerWidth}×${window.innerHeight}</span></div>
                    </div>
                </div>
                <div style="flex: 2;">
                    <div style="font-size: 10px; color: #888; margin-bottom: 5px;">コンポーネント状態</div>
                    <div id="component-status" style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; font-size: 10px; max-height: 60px; overflow-y: auto;">
                        読み込み中...
                    </div>
                </div>
            </div>
            
            <div style="flex: 1; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 10px; color: #888;">ログ出力</span>
                    <div style="display: flex; gap: 5px;">
                        <button onclick="window.emergencyDebug.toggleAutoScroll()" id="auto-scroll-btn" style="padding: 2px 6px; background: #4CAF50; border: none; border-radius: 3px; color: white; font-size: 9px; cursor: pointer;">自動スクロール: ON</button>
                        <button onclick="window.emergencyDebug.toggleFilter()" id="filter-btn" style="padding: 2px 6px; background: #2196F3; border: none; border-radius: 3px; color: white; font-size: 9px; cursor: pointer;">フィルター: ON</button>
                    </div>
                </div>
                <div id="debug-logs" style="flex: 1; background: rgba(0,0,0,0.7); padding: 10px; border-radius: 6px; overflow-y: auto; white-space: pre-wrap; font-size: 11px; line-height: 1.3; border: 1px solid rgba(255,255,255,0.1);"></div>
            </div>
        `;
        
        document.body.appendChild(this.panel);
        
        // デバッグボタン作成
        this.createDebugButtons();
        
        // 要素参照を取得
        this.logsContainer = this.panel.querySelector('#debug-logs');
        this.logCountEl = this.panel.querySelector('#log-count');
        this.statusEl = this.panel.querySelector('#debug-status');
        this.timeEl = this.panel.querySelector('#debug-time');
        this.componentStatusEl = this.panel.querySelector('#component-status');
        this.connectionStatusEl = this.panel.querySelector('#connection-status');
        this.screenInfoEl = this.panel.querySelector('#screen-info');
        
        // 設定
        this.autoScroll = true;
        this.filterEnabled = true;
    }
    

createDebugButtons() {
    // メインデバッグボタン
    const mainBtn = document.createElement('button');
    mainBtn.id = 'main-debug-btn';
    mainBtn.innerHTML = '🔧';
    mainBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 56px;
        height: 56px;
        border-radius: 28px;
        background: linear-gradient(135deg, #FF5722, #FF9800);
        border: none;
        color: white;
        font-size: 24px;
        z-index: 999998;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(255, 87, 34, 0.4);
        transition: all 0.3s ease;
    `;
    mainBtn.onmouseover = () => mainBtn.style.transform = 'scale(1.1)';
    mainBtn.onmouseout = () => mainBtn.style.transform = 'scale(1)';
    mainBtn.onclick = () => this.toggle();
    document.body.appendChild(mainBtn);
    
    // サブデバッグボタン（緊急診断）
    const subBtn = document.createElement('button');
    subBtn.id = 'sub-debug-btn';
    subBtn.innerHTML = '🆘';
    subBtn.style.cssText = `
        position: fixed;
        bottom: 90px;
        right: 20px;
        width: 48px;
        height: 48px;
        border-radius: 24px;
        background: linear-gradient(135deg, #9C27B0, #E91E63);
        border: none;
        color: white;
        font-size: 20px;
        z-index: 999998;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(156, 39, 176, 0.4);
        transition: all 0.3s ease;
    `;
    subBtn.onmouseover = () => subBtn.style.transform = 'scale(1.1)';
    subBtn.onmouseout = () => subBtn.style.transform = 'scale(1)';
    subBtn.onclick = () => this.runEmergencyDiag();
    document.body.appendChild(subBtn);
    
    // 🔧 修正ボタン（スマホ用修正）
    const fixBtn = document.createElement('button');
    fixBtn.id = 'fix-debug-btn';
    fixBtn.innerHTML = '🔨';
    fixBtn.title = 'スマホ用修正';
    fixBtn.style.cssText = `
        position: fixed;
        bottom: 160px;
        right: 20px;
        width: 44px;
        height: 44px;
        border-radius: 22px;
        background: linear-gradient(135deg, #4CAF50, #8BC34A);
        border: none;
        color: white;
        font-size: 18px;
        z-index: 999998;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(76, 175, 80, 0.4);
        transition: all 0.3s ease;
    `;
    fixBtn.onmouseover = () => fixBtn.style.transform = 'scale(1.1)';
    fixBtn.onmouseout = () => fixBtn.style.transform = 'scale(1)';
    
    // 🔧 修正機能の実装
    fixBtn.onclick = () => {
        console.log('🔧 スマホ用修正実行中...');
        this.addLog('スマホ用修正を開始します...', 'info');
        
        // 1. スクロール修正
        const panel = document.getElementById('emergency-debug-panel');
        if (panel) {
            panel.style.position = 'fixed';
            panel.style.top = '5px';
            panel.style.left = '5px';
            panel.style.right = '5px';
            panel.style.bottom = '5px';
            panel.style.overflow = 'hidden';
            panel.style.display = 'flex';
            panel.style.flexDirection = 'column';
            
            const logsContainer = panel.querySelector('#debug-logs');
            if (logsContainer) {
                logsContainer.style.flex = '1';
                logsContainer.style.overflowY = 'auto';
                logsContainer.style.overflowX = 'hidden';
                logsContainer.style.webkitOverflowScrolling = 'touch';
                logsContainer.style.touchAction = 'pan-y';
                logsContainer.style.maxHeight = 'none';
                logsContainer.style.height = 'auto';
                logsContainer.style.fontSize = '9px';
                logsContainer.style.lineHeight = '1.2';
                logsContainer.style.padding = '8px';
                logsContainer.style.background = 'rgba(0,0,0,0.8)';
                logsContainer.style.borderRadius = '6px';
                logsContainer.style.wordWrap = 'break-word';
                logsContainer.style.whiteSpace = 'pre-wrap';
                
                this.addLog('ログエリアスクロール修正完了', 'success');
                
                setTimeout(() => {
                    logsContainer.scrollTop = logsContainer.scrollHeight;
                }, 100);
            }
            
            // ヘッダーをコンパクト化
            const header = panel.querySelector('div:first-child');
            if (header) {
                header.style.flexShrink = '0';
                header.style.height = '50px';
                header.style.marginBottom = '8px';
                
                const title = header.querySelector('h3');
                if (title) {
                    title.textContent = '🚀 ミニロト デバッグ';
                    title.style.fontSize = '14px';
                }
                
                const buttons = header.querySelectorAll('button');
                buttons.forEach(btn => {
                    btn.style.padding = '2px 4px';
                    btn.style.fontSize = '8px';
                    btn.style.margin = '0 1px';
                });
            }
            
            // 中間エリアを非表示
            const statusArea = panel.querySelector('div:nth-child(2)');
            if (statusArea) {
                statusArea.style.display = 'none';
            }
            
            // ログコントロールをコンパクト化
            const logControls = panel.querySelector('div:nth-last-child(2)');
            if (logControls) {
                logControls.style.flexShrink = '0';
                logControls.style.height = '25px';
                logControls.style.marginBottom = '8px';
                
                const controlButtons = logControls.querySelectorAll('button');
                controlButtons.forEach(btn => {
                    btn.style.padding = '1px 4px';
                    btn.style.fontSize = '7px';
                });
            }
        }
        
        // 2. UI修正
        this.addLog('UI修正を実行中...', 'info');
        
        if (typeof window.UI === 'function') {
            if (!window.ui) {
                try {
                    this.addLog('UIインスタンス作成中...', 'info');
                    window.ui = new window.UI();
                    this.addLog('UIインスタンス作成成功', 'success');
                } catch (error) {
                    this.addLog(`UIインスタンス作成失敗: ${error.message}`, 'error');
                }
            } else {
                this.addLog('UIインスタンス既に存在', 'info');
            }
        } else {
            this.addLog('UIクラスが見つかりません', 'error');
            
            const script = document.createElement('script');
            script.src = '/static/js/ui.js?t=' + Date.now();
            script.onload = () => {
                this.addLog('ui.js 手動読み込み成功', 'success');
                setTimeout(() => {
                    if (window.UI && !window.ui) {
                        try {
                            window.ui = new window.UI();
                            this.addLog('UIインスタンス手動作成成功', 'success');
                        } catch (error) {
                            this.addLog(`UIインスタンス手動作成失敗: ${error.message}`, 'error');
                        }
                    }
                }, 500);
            };
            script.onerror = () => {
                this.addLog('ui.js 手動読み込み失敗', 'error');
            };
            document.head.appendChild(script);
        }
        
        // 3. スマホ用操作ボタン作成
        this.createMobileControls();
        
        // 4. 修正完了
        setTimeout(() => {
            this.addLog('スマホ用修正が完了しました', 'success');
            this.addLog('ログエリアをタッチしてスクロールしてみてください', 'info');
        }, 500);
    };
    
    document.body.appendChild(fixBtn);
}

    
    setupConsoleInterception() {
        // 元のコンソール関数を保存
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug
        };
        
        // コンソールをインターセプト
        const methods = ['log', 'error', 'warn', 'info', 'debug'];
        methods.forEach(method => {
            console[method] = (...args) => {
                this.originalConsole[method].apply(console, args);
                this.addLog(args.join(' '), method);
            };
        });
    }
    
    setupErrorHandling() {
        // JavaScript エラーをキャッチ
        window.addEventListener('error', (event) => {
            this.addLog(`エラー: ${event.error?.message || event.message} (${event.filename}:${event.lineno})`, 'error');
        });
        
        // Promise rejection をキャッチ
        window.addEventListener('unhandledrejection', (event) => {
            this.addLog(`未処理Promise拒否: ${event.reason}`, 'error');
        });
    }
    
    setupSystemMonitoring() {
        // 定期的なシステム状態更新
        setInterval(() => {
            this.updateSystemStatus();
        }, 2000);
        
        // 接続状態監視
        window.addEventListener('online', () => {
            this.addLog('ネットワーク接続が回復しました', 'success');
            this.updateConnectionStatus();
        });
        
        window.addEventListener('offline', () => {
            this.addLog('ネットワーク接続が切断されました', 'warn');
            this.updateConnectionStatus();
        });
    }
    
    addLog(message, type = 'log') {
        // スパムフィルター
        if (this.filterEnabled) {
            const hash = this.hashMessage(message);
            const now = Date.now();
            
            if (this.spamFilter.has(hash)) {
                const lastTime = this.spamFilter.get(hash);
                if (now - lastTime < this.spamTimeout) {
                    return; // スパムとして無視
                }
            }
            this.spamFilter.set(hash, now);
        }
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            time: timestamp,
            message: message,
            type: type,
            id: Date.now() + Math.random()
        };
        
        this.logs.push(logEntry);
        
        // ログ数制限
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        this.renderLogs();
        this.updateLogCount();
    }
    
    renderLogs() {
        if (!this.logsContainer) return;
        
        const html = this.logs.map(log => {
            const color = this.getLogColor(log.type);
            const icon = this.getLogIcon(log.type);
            return `<div style="color: ${color}; margin-bottom: 2px;">[${log.time}] ${icon} ${log.message}</div>`;
        }).join('');
        
        this.logsContainer.innerHTML = html;
        
        if (this.autoScroll) {
            this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
        }
    }
    
    getLogColor(type) {
        const colors = {
            log: '#e0e0e0',
            info: '#2196F3',
            warn: '#FF9800',
            error: '#f44336',
            debug: '#9C27B0',
            success: '#4CAF50'
        };
        return colors[type] || colors.log;
    }
    
    getLogIcon(type) {
        const icons = {
            log: '📝',
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌',
            debug: '🔍',
            success: '✅'
        };
        return icons[type] || icons.log;
    }
    
    hashMessage(message) {
        // 簡単なハッシュ関数
        let hash = 0;
        for (let i = 0; i < message.length; i++) {
            const char = message.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32bit integer に変換
        }
        return hash;
    }
    
    updateSystemStatus() {
        if (this.timeEl) {
            this.timeEl.textContent = new Date().toLocaleTimeString();
        }
        
        this.updateConnectionStatus();
        this.updateScreenInfo();
        this.updateComponentStatus();
    }
    
    updateConnectionStatus() {
        if (this.connectionStatusEl) {
            this.connectionStatusEl.textContent = navigator.onLine ? 'オンライン' : 'オフライン';
            this.connectionStatusEl.style.color = navigator.onLine ? '#4CAF50' : '#f44336';
        }
    }
    
    updateScreenInfo() {
        if (this.screenInfoEl) {
            this.screenInfoEl.textContent = `${window.innerWidth}×${window.innerHeight}`;
        }
    }
    
    updateComponentStatus() {
        if (!this.componentStatusEl) return;
        
        const components = [
            { name: 'API', obj: window.API, instance: window.api },
            { name: 'UI', obj: window.UI, instance: window.ui },
            { name: 'App', obj: window.app },
            { name: 'MobileOptimizer', obj: window.mobileOptimizer },
            { name: 'PWA', obj: window.pwaManager }
        ];
        
        const html = components.map(comp => {
            let status = '❌';
            let color = '#f44336';
            
            if (comp.obj && typeof comp.obj === 'function') {
                if (comp.instance && typeof comp.instance === 'object') {
                    status = '✅';
                    color = '#4CAF50';
                } else {
                    status = '⚠️';
                    color = '#FF9800';
                }
            } else if (comp.obj && typeof comp.obj === 'object') {
                status = '✅';
                color = '#4CAF50';
            }
            
            return `<div style="color: ${color};">${status} ${comp.name}</div>`;
        }).join('');
        
        this.componentStatusEl.innerHTML = html;
    }
    
    updateLogCount() {
        if (this.logCountEl) {
            this.logCountEl.textContent = this.logs.length;
        }
    }
    
    // === デバッグ機能 ===
    
    show() {
        this.panel.style.display = 'flex';
        this.isVisible = true;
        this.addLog('デバッグパネルを表示しました', 'info');
        this.updateSystemStatus();
    }
    
    hide() {
        this.panel.style.display = 'none';
        this.isVisible = false;
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    clearLogs() {
        this.logs = [];
        this.renderLogs();
        this.updateLogCount();
        this.addLog('ログをクリアしました', 'info');
    }
    
    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        const btn = document.getElementById('auto-scroll-btn');
        if (btn) {
            btn.textContent = `自動スクロール: ${this.autoScroll ? 'ON' : 'OFF'}`;
            btn.style.background = this.autoScroll ? '#4CAF50' : '#666';
        }
        this.addLog(`自動スクロールを${this.autoScroll ? '有効' : '無効'}にしました`, 'info');
    }
    
    toggleFilter() {
        this.filterEnabled = !this.filterEnabled;
        const btn = document.getElementById('filter-btn');
        if (btn) {
            btn.textContent = `フィルター: ${this.filterEnabled ? 'ON' : 'OFF'}`;
            btn.style.background = this.filterEnabled ? '#2196F3' : '#666';
        }
        this.addLog(`スパムフィルターを${this.filterEnabled ? '有効' : '無効'}にしました`, 'info');
    }
    
    runQuickDiag() {
        this.addLog('=== クイック診断開始 ===', 'info');
        
        const checks = [
            () => this.checkGlobals(),
            () => this.checkScripts(),
            () => this.checkAPI()
        ];
        
        checks.forEach(check => {
            try {
                check();
            } catch (error) {
                this.addLog(`診断エラー: ${error.message}`, 'error');
            }
        });
        
        this.addLog('=== クイック診断完了 ===', 'info');
    }
    
    async runFullDiag() {
        this.addLog('=== 完全診断開始 ===', 'info');
        
        try {
            this.checkGlobals();
            this.checkScripts();
            this.checkAPI();
            this.checkServiceWorker();
            await this.checkNetworkConnectivity();
            this.checkLocalStorage();
            this.checkPerformance();
        } catch (error) {
            this.addLog(`完全診断エラー: ${error.message}`, 'error');
        }
        
        this.addLog('=== 完全診断完了 ===', 'info');
    }
    
    runEmergencyDiag() {
        this.addLog('🆘 緊急診断実行中...', 'warn');
        this.show();
        
        setTimeout(() => {
            this.runFullDiag();
            this.addLog('🆘 緊急診断が完了しました', 'success');
        }, 500);
    }
    
    checkGlobals() {
        const globals = ['API', 'UI', 'api', 'ui', 'app', 'mobileOptimizer'];
        globals.forEach(name => {
            const exists = window[name] !== undefined;
            const type = typeof window[name];
            this.addLog(`グローバル ${name}: ${exists ? '✅' : '❌'} (${type})`, exists ? 'success' : 'error');
        });
    }
    
    checkScripts() {
        const scripts = document.querySelectorAll('script[src]');
        this.addLog(`読み込み済みスクリプト数: ${scripts.length}`, 'info');
        
        const expectedScripts = ['api.js', 'ui.js', 'main.js', 'analysis.js', 'pwa.js', 'mobile.js'];
        expectedScripts.forEach(scriptName => {
            const found = Array.from(scripts).some(script => script.src.includes(scriptName));
            this.addLog(`スクリプト ${scriptName}: ${found ? '✅' : '❌'}`, found ? 'success' : 'error');
        });
    }
    
    async checkAPI() {
        if (!window.api) {
            this.addLog('API インスタンスが存在しません', 'error');
            return;
        }
        
        try {
            const response = await fetch('/');
            this.addLog(`サーバー接続: ${response.ok ? '✅' : '❌'} (${response.status})`, response.ok ? 'success' : 'error');
        } catch (error) {
            this.addLog(`サーバー接続エラー: ${error.message}`, 'error');
        }
    }
    
    checkServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                this.addLog(`Service Worker登録数: ${registrations.length}`, 'info');
                registrations.forEach((reg, index) => {
                    this.addLog(`SW ${index + 1}: ${reg.active?.state || 'inactive'}`, 'info');
                });
            });
        } else {
            this.addLog('Service Worker未対応', 'warn');
        }
    }
    
    async checkNetworkConnectivity() {
        try {
            const start = performance.now();
            const response = await fetch('/', { method: 'HEAD' });
            const end = performance.now();
            const responseTime = Math.round(end - start);
            
            this.addLog(`ネットワーク応答時間: ${responseTime}ms`, 'info');
            
            if (navigator.connection) {
                const conn = navigator.connection;
                this.addLog(`接続タイプ: ${conn.effectiveType || 'unknown'}`, 'info');
                this.addLog(`ダウンリンク: ${conn.downlink || 'unknown'}Mbps`, 'info');
            }
        } catch (error) {
            this.addLog(`ネットワーク診断エラー: ${error.message}`, 'error');
        }
    }
    
    checkLocalStorage() {
        try {
            const testKey = 'debug-test';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            this.addLog('LocalStorage: ✅ 利用可能', 'success');
            
            const usage = JSON.stringify(localStorage).length;
            this.addLog(`LocalStorage使用量: ${usage} bytes`, 'info');
        } catch (error) {
            this.addLog(`LocalStorage: ❌ ${error.message}`, 'error');
        }
    }
    
    checkPerformance() {
        if ('memory' in performance) {
            const memory = performance.memory;
            this.addLog(`メモリ使用量: ${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`, 'info');
            this.addLog(`メモリ制限: ${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`, 'info');
        }
        
        const timing = performance.timing;
        if (timing) {
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            this.addLog(`ページ読み込み時間: ${loadTime}ms`, 'info');
        }
    }
    
    exportLogs() {
        const logText = this.logs.map(log => 
            `[${log.time}] ${log.type.toUpperCase()}: ${log.message}`
        ).join('\n');
        
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `miniloto-debug-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.addLog('ログをエクスポートしました', 'success');
    }

// EmergencyDebugSystem クラスの exportLogs() メソッドの後に追加

createMobileControls() {
    // 既存のコントロールを削除
    const existing = document.getElementById('mobile-debug-controls');
    if (existing) existing.remove();
    
    // 新しいコントロールパネル作成
    const controls = document.createElement('div');
    controls.id = 'mobile-debug-controls';
    controls.style.cssText = `
        position: fixed;
        bottom: 5px;
        left: 5px;
        right: 5px;
        height: 50px;
        background: rgba(0,0,0,0.9);
        border-radius: 8px;
        display: flex;
        justify-content: space-around;
        align-items: center;
        z-index: 999997;
        padding: 5px;
        border: 1px solid rgba(255,255,255,0.2);
    `;
    
    // ボタン作成関数
    const createBtn = (emoji, text, color, action) => {
        const btn = document.createElement('button');
        btn.innerHTML = `${emoji}<br><span style="font-size:8px;">${text}</span>`;
        btn.style.cssText = `
            width: 50px;
            height: 40px;
            background: ${color};
            border: none;
            border-radius: 6px;
            color: white;
            font-size: 12px;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            line-height: 1;
        `;
        btn.onclick = action;
        return btn;
    };
    
    // ボタン群
    const clearBtn = createBtn('🗑️', 'クリア', '#FF9800', () => {
        this.clearLogs();
    });
    
    const diagBtn = createBtn('🔍', '診断', '#2196F3', () => {
        this.runQuickDiag();
    });
    
    const scrollBtn = createBtn('📜', '最下部', '#9C27B0', () => {
        const logsContainer = document.querySelector('#debug-logs');
        if (logsContainer) {
            logsContainer.scrollTop = logsContainer.scrollHeight;
        }
    });
    
    const closeBtn = createBtn('✖️', '閉じる', '#f44336', () => {
        this.hide();
        controls.remove();
    });
    
    controls.appendChild(clearBtn);
    controls.appendChild(diagBtn);
    controls.appendChild(scrollBtn);
    controls.appendChild(closeBtn);
    
    document.body.appendChild(controls);
    this.addLog('スマホ用操作ボタンを追加しました', 'success');
}

}

// ===== 2. 自動初期化システム =====
class AutoInitializer {
    constructor() {
        this.initAttempts = 0;
        this.maxAttempts = 5;
        this.retryDelay = 1000; // 1秒
        
        this.init();
    }
    
    init() {
        console.log('🔄 自動初期化システム開始...');
        this.attemptInitialization();
    }
    
    attemptInitialization() {
        this.initAttempts++;
        console.log(`🔄 初期化試行 ${this.initAttempts}/${this.maxAttempts}`);
        
        if (window.emergencyDebug) {
            console.log('✅ デバッグシステム既に初期化済み');
            return;
        }
        
        try {
            window.emergencyDebug = new EmergencyDebugSystem();
            console.log('✅ 緊急デバッグシステム初期化成功');
            
            // 成功時の追加設定
            this.setupSuccessHandlers();
            
        } catch (error) {
            console.error(`❌ 初期化失敗 (${this.initAttempts}/${this.maxAttempts}):`, error);
            
            if (this.initAttempts < this.maxAttempts) {
                setTimeout(() => this.attemptInitialization(), this.retryDelay);
            } else {
                console.error('🚨 初期化の最大試行回数に達しました');
                this.createMinimalDebug();
            }
        }
    }
    
    setupSuccessHandlers() {
        // ページ読み込み完了後の追加チェック
        if (document.readyState === 'complete') {
            this.runPostLoadChecks();
        } else {
            window.addEventListener('load', () => this.runPostLoadChecks());
        }
        
        // 既存のデバッグシステムとの互換性確保
        if (!window.mobileDebug) {
            window.mobileDebug = window.emergencyDebug;
        }
    }
    
    runPostLoadChecks() {
        setTimeout(() => {
            if (window.emergencyDebug) {
                window.emergencyDebug.addLog('ページ読み込み完了後チェック実行', 'info');
                window.emergencyDebug.runQuickDiag();
            }
        }, 2000);
    }
    
    createMinimalDebug() {
        // 最小限のデバッグ機能を作成
        console.log('🆘 最小限デバッグシステム作成...');
        
        const minimalPanel = document.createElement('div');
        minimalPanel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 999999;
            font-family: monospace;
            font-size: 12px;
        `;
        
        minimalPanel.innerHTML = `
            <h4 style="margin: 0 0 10px 0;">🆘 最小限デバッグ</h4>
            <p>完全なデバッグシステムの初期化に失敗しました。</p>
            <p>User Agent: ${navigator.userAgent.substring(0, 50)}...</p>
            <p>画面サイズ: ${window.innerWidth}×${window.innerHeight}</p>
            <p>オンライン: ${navigator.onLine}</p>
            <button onclick="location.reload()" style="background: white; color: red; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                ページ再読み込み
            </button>
            <button onclick="this.parentElement.remove()" style="background: #666; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-left: 5px;">
                閉じる
            </button>
        `;
        
        document.body.appendChild(minimalPanel);
        
        // 5秒後に自動で非表示
        setTimeout(() => {
            if (minimalPanel.parentElement) {
                minimalPanel.style.opacity = '0.5';
            }
        }, 5000);
    }
}

// ===== 3. 互換性レイヤー =====
class CompatibilityLayer {
    constructor() {
        this.setupLegacySupport();
        this.setupMobileDebugAlias();
    }
    
    setupLegacySupport() {
        // 既存のmobileDebugとの互換性を確保
        if (!window.mobileDebug && window.emergencyDebug) {
            window.mobileDebug = {
                toggle: () => window.emergencyDebug.toggle(),
                show: () => window.emergencyDebug.show(),
                hide: () => window.emergencyDebug.hide(),
                addLog: (msg, type) => window.emergencyDebug.addLog(msg, type),
                clearLogs: () => window.emergencyDebug.clearLogs()
            };
        }
    }
    
    setupMobileDebugAlias() {
        // 古いコードとの互換性のため
        if (!window.systemChecker && window.emergencyDebug) {
            window.systemChecker = {
                runDiagnostics: () => window.emergencyDebug.runFullDiag()
            };
        }
    }
}

// ===== 4. 実行制御システム =====
class ExecutionController {
    constructor() {
        this.initialized = false;
        this.readyCallbacks = [];
        
        this.init();
    }
    
    init() {
        console.log('🎮 実行制御システム初期化...');
        
        // DOM準備完了時
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.onDOMReady());
        } else {
            this.onDOMReady();
        }
        
        // ページ完全読み込み時
        if (document.readyState === 'complete') {
            this.onPageLoad();
        } else {
            window.addEventListener('load', () => this.onPageLoad());
        }
        
        // 遅延初期化（保険）
        setTimeout(() => this.onDelayedInit(), 3000);
        setTimeout(() => this.onFinalInit(), 5000);
    }
    
    onDOMReady() {
        console.log('📄 DOM準備完了');
        this.executeIfNotInitialized();
    }
    
    onPageLoad() {
        console.log('🌐 ページ読み込み完了');
        this.executeIfNotInitialized();
    }
    
    onDelayedInit() {
        console.log('⏰ 遅延初期化実行');
        this.executeIfNotInitialized();
    }
    
    onFinalInit() {
        console.log('🏁 最終初期化実行');
        this.executeIfNotInitialized(true);
    }
    
    executeIfNotInitialized(force = false) {
        if (this.initialized && !force) {
            return;
        }
        
        if (!window.emergencyDebug) {
            console.log('🚀 デバッグシステム初期化実行...');
            new AutoInitializer();
            new CompatibilityLayer();
            this.initialized = true;
            
            // 準備完了コールバック実行
            this.readyCallbacks.forEach(callback => {
                try {
                    callback();
                } catch (error) {
                    console.error('準備完了コールバックエラー:', error);
                }
            });
            this.readyCallbacks = [];
        }
    }
    
    onReady(callback) {
        if (this.initialized && window.emergencyDebug) {
            callback();
        } else {
            this.readyCallbacks.push(callback);
        }
    }
}

// ===== 5. 即座実行部分 =====

console.log('🚀 完全統合デバッグシステム開始...');

// 即座に実行制御システムを開始
const executionController = new ExecutionController();

// グローバルに公開
window.debugController = executionController;

// 既存のtrackScript関数との互換性
if (typeof window.trackScript === 'function') {
    console.log('📊 既存のtrackScript関数を検出');
    window.trackScript('debug-complete.js', true);
} else {
    // trackScript関数が存在しない場合の代替
    console.log('📊 trackScript関数未検出 - 代替処理実行');
}

// Service Worker メッセージハンドラー
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATED' && window.emergencyDebug) {
            window.emergencyDebug.addLog('Service Worker が更新されました', 'info');
        }
    });
}

// ページ離脱時の処理
window.addEventListener('beforeunload', () => {
    if (window.emergencyDebug) {
        console.log('👋 ページ離脱 - デバッグセッション終了');
    }
});

// 手動初期化関数をグローバルに公開（緊急時用）
window.forceInitializeDebugSystem = () => {
    console.log('🔧 手動デバッグシステム初期化実行...');
    
    if (window.emergencyDebug) {
        console.log('既にデバッグシステムが存在します');
        window.emergencyDebug.show();
        return;
    }
    
    try {
        window.emergencyDebug = new EmergencyDebugSystem();
        new CompatibilityLayer();
        console.log('✅ 手動初期化成功');
        
        if (window.emergencyDebug) {
            window.emergencyDebug.show();
            window.emergencyDebug.addLog('手動初期化により起動しました', 'success');
        }
    } catch (error) {
        console.error('❌ 手動初期化失敗:', error);
        alert('デバッグシステムの手動初期化に失敗しました: ' + error.message);
    }
};

// デバッグ用のグローバル関数
window.debugInfo = () => {
    const info = {
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}×${window.innerHeight}`,
        online: navigator.onLine,
        cookieEnabled: navigator.cookieEnabled,
        language: navigator.language,
        platform: navigator.platform,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        memory: performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB` : 'N/A',
        connection: navigator.connection ? navigator.connection.effectiveType : 'N/A'
    };
    
    console.table(info);
    return info;
};

// 緊急アクセス用の簡易関数
window.showDebug = () => {
    if (window.emergencyDebug) {
        window.emergencyDebug.show();
    } else {
        window.forceInitializeDebugSystem();
    }
};

window.hideDebug = () => {
    if (window.emergencyDebug) {
        window.emergencyDebug.hide();
    }
};

console.log('✅ 完全統合デバッグシステム読み込み完了');
console.log('🎯 使用方法:');
console.log('  - window.showDebug() : デバッグパネル表示');
console.log('  - window.hideDebug() : デバッグパネル非表示');
console.log('  - window.debugInfo() : システム情報表示');
console.log('  - 画面右下の🔧ボタン : デバッグパネル切り替え');
console.log('  - 画面右下の🆘ボタン : 緊急診断実行');