// 🔧 緊急デバッグシステム修正用スクリプト
// このコードを新しいファイル static/js/debug-fix.js として保存してください

console.log('🔧 緊急デバッグシステム修正開始...');

// 1. Service Workerキャッシュの更新確認
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        console.log('Service Worker登録数:', registrations.length);
        registrations.forEach(registration => {
            console.log('Service Worker状態:', registration.active?.state);
            // キャッシュを強制更新
            registration.update();
        });
    });
}

// 2. 強制的なデバッグシステム初期化
function forceInitializeDebugSystem() {
    console.log('🔧 強制デバッグシステム初期化開始...');
    
    // デバッグパネルが既に存在する場合は削除
    const existingPanel = document.querySelector('#mobile-debug-panel');
    if (existingPanel) {
        existingPanel.remove();
        console.log('既存のデバッグパネルを削除');
    }
    
    // デバッグボタンが既に存在する場合は削除
    const existingBtn = document.querySelector('#manual-debug-btn');
    if (existingBtn) {
        existingBtn.remove();
        console.log('既存のデバッグボタンを削除');
    }
    
    // 新しいデバッグシステムを作成
    createEmergencyDebugSystem();
}

// 3. 緊急デバッグシステム作成
function createEmergencyDebugSystem() {
    console.log('📱 緊急デバッグシステム作成中...');
    
    // デバッグパネル作成
    const panel = document.createElement('div');
    panel.id = 'mobile-debug-panel';
    panel.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        right: 10px;
        bottom: 10px;
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 15px;
        border-radius: 10px;
        z-index: 999999;
        display: none;
        flex-direction: column;
        font-family: monospace;
        font-size: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 10px;">
            <h3 style="margin: 0; color: #4CAF50;">📱 緊急デバッグシステム</h3>
            <div>
                <button onclick="emergencyDebug.clearLogs()" style="margin-right: 5px; padding: 5px 10px; background: #FF9800; border: none; border-radius: 5px; color: white; cursor: pointer;">クリア</button>
                <button onclick="emergencyDebug.runDiagnostics()" style="margin-right: 5px; padding: 5px 10px; background: #2196F3; border: none; border-radius: 5px; color: white; cursor: pointer;">診断</button>
                <button onclick="emergencyDebug.hide()" style="padding: 5px 10px; background: #f44336; border: none; border-radius: 5px; color: white; cursor: pointer;">×</button>
            </div>
        </div>
        <div id="emergency-logs" style="flex: 1; overflow-y: auto; background: #111; padding: 10px; border-radius: 5px; white-space: pre-wrap;"></div>
        <div style="margin-top: 10px; font-size: 10px; color: #888; display: flex; justify-content: space-between;">
            <span>緊急デバッグモード</span>
            <span id="emergency-status">システム状態: 確認中...</span>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // デバッグボタン作成
    const debugBtn = document.createElement('button');
    debugBtn.id = 'manual-debug-btn';
    debugBtn.innerHTML = '🔧';
    debugBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        border-radius: 25px;
        background: #FF5722;
        border: none;
        color: white;
        font-size: 20px;
        z-index: 999999;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    debugBtn.onclick = () => emergencyDebug.toggle();
    document.body.appendChild(debugBtn);
    
    // グローバルデバッグオブジェクト作成
    window.emergencyDebug = {
        panel: panel,
        logsContainer: panel.querySelector('#emergency-logs'),
        statusEl: panel.querySelector('#emergency-status'),
        logs: [],
        
        show() {
            this.panel.style.display = 'flex';
            this.updateStatus();
            this.loadRecentLogs();
        },
        
        hide() {
            this.panel.style.display = 'none';
        },
        
        toggle() {
            if (this.panel.style.display === 'none' || !this.panel.style.display) {
                this.show();
            } else {
                this.hide();
            }
        },
        
        clearLogs() {
            this.logs = [];
            this.logsContainer.textContent = '';
            this.addLog('ログがクリアされました', 'info');
        },
        
        addLog(message, type = 'log') {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
            this.logs.push(logEntry);
            
            // 最大100件まで保持
            if (this.logs.length > 100) {
                this.logs.shift();
            }
            
            // 表示に反映
            this.logsContainer.textContent = this.logs.join('\n');
            this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
        },
        
        loadRecentLogs() {
            // 既存のコンソールログを取得（可能な範囲で）
            this.addLog('緊急デバッグシステム起動', 'info');
            this.addLog(`User Agent: ${navigator.userAgent}`, 'info');
            this.addLog(`画面サイズ: ${window.innerWidth}x${window.innerHeight}`, 'info');
            this.addLog(`オンライン状態: ${navigator.onLine ? 'オンライン' : 'オフライン'}`, 'info');
        },
        
        updateStatus() {
            let status = '正常';
            
            // 各種チェック
            if (!window.API) status = 'API未読み込み';
            else if (!window.UI) status = 'UI未読み込み';
            else if (!window.api) status = 'APIインスタンス未作成';
            else if (!window.ui) status = 'UIインスタンス未作成';
            
            this.statusEl.textContent = `システム状態: ${status}`;
        },
        
        async runDiagnostics() {
            this.addLog('=== システム診断開始 ===', 'info');
            
            // 1. 基本クラス確認
            this.addLog(`API クラス: ${typeof window.API}`, 'info');
            this.addLog(`UI クラス: ${typeof window.UI}`, 'info');
            this.addLog(`api インスタンス: ${typeof window.api}`, 'info');
            this.addLog(`ui インスタンス: ${typeof window.ui}`, 'info');
            
            // 2. ファイル読み込み状況確認
            const scripts = document.querySelectorAll('script[src]');
            this.addLog(`読み込み済みスクリプト数: ${scripts.length}`, 'info');
            scripts.forEach(script => {
                const src = script.src.split('/').pop();
                this.addLog(`スクリプト: ${src} (${script.onload ? '読み込み成功' : '状態不明'})`, 'info');
            });
            
            // 3. Service Worker状況
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                this.addLog(`Service Worker登録数: ${registrations.length}`, 'info');
            }
            
            // 4. 接続テスト
            try {
                const response = await fetch('/');
                this.addLog(`サーバー接続: ${response.ok ? 'OK' : 'エラー'}`, response.ok ? 'info' : 'error');
            } catch (error) {
                this.addLog(`サーバー接続エラー: ${error.message}`, 'error');
            }
            
            this.addLog('=== システム診断完了 ===', 'info');
        }
    };
    
    // コンソールログをインターセプト
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
    };
    
    ['log', 'error', 'warn', 'info'].forEach(method => {
        console[method] = function(...args) {
            originalConsole[method].apply(console, args);
            if (window.emergencyDebug) {
                window.emergencyDebug.addLog(args.join(' '), method);
            }
        };
    });
    
    // エラーイベントをキャッチ
    window.addEventListener('error', (event) => {
        if (window.emergencyDebug) {
            window.emergencyDebug.addLog(`エラー: ${event.error?.message || event.message}`, 'error');
        }
    });
    
    console.log('✅ 緊急デバッグシステム初期化完了');
}

// 4. 実行タイミングの制御
function initializeWhenReady() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', forceInitializeDebugSystem);
    } else {
        forceInitializeDebugSystem();
    }
    
    // 追加の安全確保（2秒後にも実行）
    setTimeout(() => {
        if (!window.emergencyDebug) {
            console.log('🔧 2秒後の緊急初期化実行...');
            forceInitializeDebugSystem();
        }
    }, 2000);
}

// 5. 即座に実行
initializeWhenReady();

console.log('🔧 緊急デバッグシステム修正完了');