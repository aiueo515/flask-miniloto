/**
 * UI管理クラス - ロト7予測PWA
 * 完全版 - 基本機能 + 非同期対応機能
 */

class UI {
    constructor() {
        this.currentTab = 'predict';
        this.isLoadingTab = false;
        this.toasts = [];
        this.modalStack = [];
        this.init();
    }
    
    /**
     * 初期化
     */
    init() {
        this.setupEventListeners();
        this.updateConnectionStatus(navigator.onLine);
        console.log('✅ UI クラス初期化完了');
    }
    
    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // タブ切り替え
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.closest('.nav-tab').dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // 予測取得ボタン
        const getPredictionBtn = document.getElementById('get-prediction-btn');
        if (getPredictionBtn) {
            getPredictionBtn.addEventListener('click', () => {
                this.getPrediction();
            });
        }
        
        // 更新ボタン
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshCurrentTab();
            });
        }
        
        // モデル学習ボタン
        const trainModelBtn = document.getElementById('train-model-btn');
        if (trainModelBtn) {
            trainModelBtn.addEventListener('click', () => {
                this.trainModel();
            });
        }
        
        // 検証実行ボタン
        const runValidationBtn = document.getElementById('run-validation-btn');
        if (runValidationBtn) {
            runValidationBtn.addEventListener('click', () => {
                this.runValidation();
            });
        }
        
        // モーダル閉じるボタン
        const modalClose = document.getElementById('modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                this.hideModal();
            });
        }
        
        // モーダルオーバーレイクリック
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    this.hideModal();
                }
            });
        }
        
        // 接続状態監視
        window.addEventListener('online', () => {
            this.updateConnectionStatus(true);
        });
        
        window.addEventListener('offline', () => {
            this.updateConnectionStatus(false);
        });
    }
    
    /**
     * タブ切り替え
     * @param {string} tabName - タブ名
     */
    switchTab(tabName) {
        if (this.currentTab === tabName) return;
        
        // ナビゲーションタブの更新
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // コンテンツの切り替え
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
        
        this.currentTab = tabName;
        this.initTab(tabName);
    }
    
    /**
     * タブ初期化
     * @param {string} tabName - タブ名
     * @param {boolean} showUpdateToast - 更新通知を表示するか
     */
    async initTab(tabName, showUpdateToast = false) {
        if (this.isLoadingTab) return;
        
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
    
    /**
     * 現在のタブを更新
     */
    refreshCurrentTab() {
        this.initTab(this.currentTab, true);
    }
    
    /**
     * システム状態の読み込み
     */
    async loadSystemStatus() {
        try {
            const statusContainer = document.getElementById('system-status');
            if (!statusContainer) return;
            
            // ローディング表示
            statusContainer.innerHTML = `
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <p>システム状態を確認中...</p>
                </div>
            `;
            
            const response = await window.api.getSystemStatus();
            
            if (response.status === 'success') {
                this.displaySystemStatus(response.data);
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            console.error('システム状態読み込みエラー:', error);
            this.displaySystemStatusError(error.message);
        }
    }
    
    /**
     * システム状態の表示
     * @param {Object} statusData - ステータスデータ
     */
    displaySystemStatus(statusData) {
        const container = document.getElementById('system-status');
        if (!container) return;
        
        const isInitialized = statusData.initialized || false;
        const indicatorClass = isInitialized ? 'online' : 'offline';
        const statusText = isInitialized ? 'システム正常' : '初期化が必要';
        
        container.innerHTML = `
            <div class="status-header">
                <h3>システム状態</h3>
                <div class="status-indicator">
                    <span class="dot ${indicatorClass}"></span>
                    <span class="text">${statusText}</span>
                </div>
            </div>
            <div class="status-details">
                <div class="status-item">
                    <span class="status-label">非同期処理</span>
                    <span class="status-value">${statusData.async_mode ? '有効' : '無効'}</span>
                </div>
                ${statusData.memory ? `
                    <div class="status-item">
                        <span class="status-label">メモリ使用量</span>
                        <span class="status-value">${statusData.memory.memory_usage_mb}MB</span>
                    </div>
                ` : ''}
                ${statusData.celery ? `
                    <div class="status-item">
                        <span class="status-label">アクティブタスク</span>
                        <span class="status-value">${statusData.celery.active_tasks}件</span>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * システム状態エラー表示
     * @param {string} errorMessage - エラーメッセージ
     */
    displaySystemStatusError(errorMessage) {
        const container = document.getElementById('system-status');
        if (!container) return;
        
        container.innerHTML = `
            <div class="status-header">
                <h3>システム状態</h3>
                <div class="status-indicator">
                    <span class="dot offline"></span>
                    <span class="text">エラー</span>
                </div>
            </div>
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <div class="error-title">状態確認エラー</div>
                <div class="error-message">${errorMessage}</div>
                <button class="btn btn-primary" onclick="window.ui.loadSystemStatus()">
                    再試行
                </button>
            </div>
        `;
    }
    
    /**
     * 予測の読み込み
     */
    async loadPrediction() {
        const container = document.getElementById('prediction-card');
        if (!container) return;
        
        // 初期化オプションを表示
        this.showSystemInitializationOptions();
    }
    
    /**
     * 予測履歴の読み込み
     */
    async loadPredictionHistory() {
        try {
            const response = await window.api.get('/api/prediction_history', { count: 10 });
            
            if (response.status === 'success') {
                this.displayPredictionHistory(response.data);
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            console.error('予測履歴読み込みエラー:', error);
            this.displayHistoryError(error.message);
        }
    }
    
    /**
     * 予測履歴の表示
     * @param {Object} historyData - 履歴データ
     */
    displayPredictionHistory(historyData) {
        const container = document.getElementById('history-list');
        if (!container) return;
        
        if (!historyData.predictions || historyData.predictions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <div class="empty-title">予測履歴なし</div>
                    <div class="empty-description">まだ予測履歴がありません</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="history-summary">
                <h4>予測履歴 (${historyData.total_count}件)</h4>
            </div>
            <div class="history-items">
                ${historyData.predictions.map(prediction => `
                    <div class="history-item">
                        <div class="history-header-info">
                            <div class="round-info">
                                <span class="round-number">第${prediction.round}回</span>
                                <span class="round-date">${prediction.date}</span>
                            </div>
                            <div class="verification-badge ${prediction.verified ? 'badge-verified' : 'badge-pending'}">
                                ${prediction.verified ? '検証済み' : '未検証'}
                            </div>
                        </div>
                        <div class="prediction-summary">
                            <p>予測セット数: ${prediction.prediction_count}件</p>
                            ${prediction.verified ? `
                                <p>最高一致: ${prediction.max_matches}個</p>
                                <p>平均一致: ${prediction.avg_matches.toFixed(2)}個</p>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    /**
     * 履歴エラー表示
     * @param {string} errorMessage - エラーメッセージ
     */
    displayHistoryError(errorMessage) {
        const container = document.getElementById('history-list');
        if (!container) return;
        
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">❌</div>
                <div class="error-title">履歴読み込みエラー</div>
                <div class="error-message">${errorMessage}</div>
                <button class="btn btn-primary" onclick="window.ui.loadPredictionHistory()">
                    再試行
                </button>
            </div>
        `;
    }
    
    /**
     * 分析データの読み込み
     */
    async loadAnalysisData() {
        const container = document.getElementById('analysis-results');
        if (!container) return;
        
        container.innerHTML = `
            <div class="analysis-status">
                <div class="status-card">
                    <h4>🔍 分析機能</h4>
                    <p>時系列交差検証と自動学習改善を実行できます。</p>
                    <div class="analysis-controls">
                        <button class="btn btn-primary" onclick="window.ui.runValidationAsync()">
                            🔍 時系列検証実行
                        </button>
                        <button class="btn btn-secondary" onclick="window.ui.trainModelAsync()">
                            🤖 モデル学習実行
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 設定UIの更新
     */
    updateSettingsUI() {
        console.log('設定UI更新');
        // 設定タブの初期化処理
    }
    
    /**
     * 予測表示
     * @param {Object} predictionData - 予測データ
     */
    displayPrediction(predictionData) {
        const container = document.getElementById('prediction-results');
        if (!container) return;
        
        container.classList.remove('hidden');
        
        container.innerHTML = `
            <div class="prediction-header">
                <h3>第${predictionData.round}回 予測結果</h3>
                <p class="prediction-date">${predictionData.created_at}</p>
            </div>
            <div class="prediction-sets">
                ${predictionData.predictions.map((prediction, index) => `
                    <div class="prediction-set">
                        <div class="set-number">セット${index + 1}</div>
                        <div class="numbers-container">
                            ${prediction.map(num => `
                                <span class="number-ball">${num}</span>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    /**
     * 予測エラー表示
     * @param {string} errorMessage - エラーメッセージ
     */
    displayPredictionError(errorMessage) {
        const container = document.getElementById('prediction-results');
        if (!container) return;
        
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">❌</div>
                <div class="error-title">予測エラー</div>
                <div class="error-message">${errorMessage}</div>
                <button class="btn btn-primary" onclick="window.ui.getPrediction()">
                    再試行
                </button>
            </div>
        `;
    }
    
    /**
     * トースト通知表示
     * @param {string} message - メッセージ
     * @param {string} type - タイプ (success, error, warning, info)
     * @param {number} duration - 表示時間（ミリ秒、0で自動非表示なし）
     */
    showToast(message, type = 'info', duration = 5000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">×</button>
        `;
        
        // 閉じるボタンのイベント
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.removeToast(toast);
        });
        
        container.appendChild(toast);
        this.toasts.push(toast);
        
        // 自動で削除
        if (duration > 0) {
            setTimeout(() => {
                this.removeToast(toast);
            }, duration);
        }
        
        console.log(`Toast: ${message} (${type})`);
    }
    
    /**
     * トースト削除
     * @param {HTMLElement} toast - トースト要素
     */
    removeToast(toast) {
        if (toast && toast.parentNode) {
            toast.style.animation = 'slideOutDown 0.3s ease-in-out';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
            
            this.toasts = this.toasts.filter(t => t !== toast);
        }
    }
    
    /**
     * モーダル表示
     * @param {string} title - タイトル
     * @param {string} content - コンテンツHTML
     * @param {Array} buttons - ボタン配列
     */
    showModal(title, content, buttons = []) {
        const overlay = document.getElementById('modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalContent = document.getElementById('modal-content');
        const modalFooter = document.getElementById('modal-footer');
        
        if (!overlay) return;
        
        modalTitle.textContent = title;
        modalContent.innerHTML = content;
        
        // ボタンの設定
        if (buttons.length > 0) {
            modalFooter.innerHTML = buttons.map(button => `
                <button class="btn ${button.class || 'btn-secondary'}" 
                        onclick="${button.handler ? button.handler.toString() + '()' : 'window.ui.hideModal()'}">
                    ${button.text}
                </button>
            `).join('');
        } else {
            modalFooter.innerHTML = '';
        }
        
        overlay.classList.remove('hidden');
        this.modalStack.push(overlay);
        
        console.log(`Modal: ${title}`);
    }
    
    /**
     * モーダル非表示
     */
    hideModal() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        
        this.modalStack.pop();
        console.log('Modal hidden');
    }
    
    /**
     * 確認ダイアログ表示
     * @param {string} title - タイトル
     * @param {string} message - メッセージ
     * @returns {Promise<boolean>} 確認結果
     */
    showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            this.showModal(title, `<p>${message}</p>`, [
                {
                    text: 'キャンセル',
                    class: 'btn-secondary',
                    handler: () => {
                        this.hideModal();
                        resolve(false);
                    }
                },
                {
                    text: 'OK',
                    class: 'btn-primary',
                    handler: () => {
                        this.hideModal();
                        resolve(true);
                    }
                }
            ]);
        });
    }
    
    /**
     * 接続状態更新
     * @param {boolean} online - オンライン状態
     */
    updateConnectionStatus(online) {
        const statusEl = document.getElementById('connection-status');
        if (!statusEl) return;
        
        const indicator = statusEl.querySelector('.status-indicator');
        const text = statusEl.querySelector('.status-text');
        
        if (indicator) {
            indicator.className = `status-indicator ${online ? 'online' : 'offline'}`;
        }
        
        if (text) {
            text.textContent = online ? 'オンライン' : 'オフライン';
        }
        
        console.log(`接続状態: ${online ? 'オンライン' : 'オフライン'}`);
    }
}

// グローバルに公開
window.UI = UI;
console.log('✅ UI クラス定義完了');

// === 非同期対応機能の拡張 ===

Object.assign(UI.prototype, {
    
    /**
     * 🔥 非同期タスクの進捗モーダル表示
     * @param {string} title - モーダルタイトル
     * @param {string} taskId - タスクID
     * @param {Function} onComplete - 完了コールバック
     * @param {Function} onError - エラーコールバック
     */
    showProgressModal(title, taskId, onComplete, onError) {
        const content = `
            <div class="progress-modal">
                <div class="progress-info">
                    <div class="progress-status" id="progress-status">準備中...</div>
                    <div class="progress-bar-container">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
                        </div>
                        <div class="progress-percentage" id="progress-percentage">0%</div>
                    </div>
                    <div class="progress-details" id="progress-details">
                        <span id="progress-current">0</span> / <span id="progress-total">1</span>
                    </div>
                </div>
                <div class="progress-actions">
                    <button id="cancel-task-btn" class="btn btn-danger">
                        <span class="btn-icon">❌</span>
                        キャンセル
                    </button>
                </div>
            </div>
        `;
        
        // モーダル表示
        this.showModal(title, content, []);
        
        // キャンセルボタンのイベント
        document.getElementById('cancel-task-btn').addEventListener('click', async () => {
            try {
                await window.api.cancelTask(taskId);
                this.hideModal();
                this.showToast('タスクをキャンセルしました', 'warning');
            } catch (error) {
                this.showToast('キャンセルに失敗しました', 'error');
            }
        });
        
        // 進捗更新のコールバック
        const onProgress = (progress) => {
            this.updateProgress(progress);
        };
        
        const onCompleteWrapper = (result) => {
            this.hideModal();
            onComplete && onComplete(result);
        };
        
        const onErrorWrapper = (error) => {
            this.hideModal();
            this.showToast(`エラー: ${error.message}`, 'error');
            onError && onError(error);
        };
        
        // APIからポーリング開始（taskIdは既に開始済み）
        window.api.pollTaskStatus(taskId, onProgress, onCompleteWrapper, onErrorWrapper);
    },
    
    /**
     * 進捗情報の更新
     * @param {Object} progress - 進捗情報
     */
    updateProgress(progress) {
        const statusEl = document.getElementById('progress-status');
        const fillEl = document.getElementById('progress-fill');
        const percentageEl = document.getElementById('progress-percentage');
        const currentEl = document.getElementById('progress-current');
        const totalEl = document.getElementById('progress-total');
        
        if (statusEl) statusEl.textContent = progress.status || '処理中...';
        if (fillEl) fillEl.style.width = `${progress.progress || 0}%`;
        if (percentageEl) percentageEl.textContent = `${progress.progress || 0}%`;
        if (currentEl) currentEl.textContent = progress.current || 0;
        if (totalEl) totalEl.textContent = progress.total || 1;
    },
    
    /**
     * 🔥 非同期予測取得
     */
    async getPredictionAsync() {
        try {
            const taskId = await window.api.getPredictionAsync(
                // onProgress
                (progress) => {
                    console.log('予測進捗:', progress);
                },
                // onComplete
                (result) => {
                    this.displayPredictionFromAsync(result);
                },
                // onError
                (error) => {
                    console.error('予測エラー:', error);
                }
            );
            
            this.showProgressModal('予測生成中', taskId,
                (result) => {
                    this.displayPredictionFromAsync(result);
                    this.showToast('予測が完了しました！', 'success');
                },
                (error) => {
                    this.showToast(`予測エラー: ${error.message}`, 'error');
                }
            );
            
        } catch (error) {
            this.showToast(`予測開始エラー: ${error.message}`, 'error');
        }
    },
    
    /**
     * 🔥 非同期モデル学習
     */
    async trainModelAsync(options = {}) {
        try {
            const confirmed = await this.showConfirmDialog(
                'モデル学習',
                '非同期でモデル学習を開始します。処理には数分かかる場合があります。続行しますか？'
            );
            
            if (!confirmed) return;
            
            const taskId = await window.api.trainModelAsync(
                options,
                // onProgress
                (progress) => {
                    console.log('学習進捗:', progress);
                },
                // onComplete
                (result) => {
                    this.displayTrainingResults(result);
                },
                // onError
                (error) => {
                    console.error('学習エラー:', error);
                }
            );
            
            this.showProgressModal('モデル学習中', taskId,
                (result) => {
                    this.displayTrainingResults(result);
                    this.showToast('学習が完了しました！', 'success');
                    this.loadSystemStatus(); // システム状態更新
                },
                (error) => {
                    this.showToast(`学習エラー: ${error.message}`, 'error');
                }
            );
            
        } catch (error) {
            this.showToast(`学習開始エラー: ${error.message}`, 'error');
        }
    },
    
    /**
     * 🔥 非同期時系列検証
     */
    async runValidationAsync() {
        try {
            const confirmed = await this.showConfirmDialog(
                '時系列検証',
                '非同期で時系列検証を開始します。処理には時間がかかる場合があります。続行しますか？'
            );
            
            if (!confirmed) return;
            
            const taskId = await window.api.runValidationAsync(
                // onProgress
                (progress) => {
                    console.log('検証進捗:', progress);
                },
                // onComplete
                (result) => {
                    this.displayValidationResults(result);
                },
                // onError
                (error) => {
                    console.error('検証エラー:', error);
                }
            );
            
            this.showProgressModal('時系列検証中', taskId,
                (result) => {
                    this.displayValidationResults(result);
                    this.showToast('検証が完了しました！', 'success');
                },
                (error) => {
                    this.showToast(`検証エラー: ${error.message}`, 'error');
                }
            );
            
        } catch (error) {
            this.showToast(`検証開始エラー: ${error.message}`, 'error');
        }
    },
    
    /**
     * 非同期予測結果の表示
     * @param {Object} result - 非同期タスクの結果
     */
    displayPredictionFromAsync(result) {
        if (result.status === 'success') {
            // 予測データを適切な形式に変換
            const predictionData = {
                round: result.next_info?.next_round || 'Unknown',
                predictions: result.predictions || [],
                is_existing: false,
                created_at: result.next_info?.current_date || new Date().toISOString(),
                prediction_count: result.predictions?.length || 0
            };
            
            this.displayPrediction(predictionData);
        } else {
            this.displayPredictionError(result.message || '予測生成に失敗しました');
        }
    },
    
    /**
     * 非同期学習結果の表示
     * @param {Object} result - 学習結果
     */
    displayTrainingResults(result) {
        if (result.status === 'success' && result.results) {
            // 分析タブに結果を表示
            const container = document.getElementById('analysis-results');
            if (container) {
                container.innerHTML = `
                    <div class="training-results">
                        <div class="analysis-card">
                            <h4>🤖 非同期学習完了</h4>
                            
                            ${result.results.training ? `
                                <div class="training-success">
                                    <h5>✅ モデル学習完了</h5>
                                    <div class="metric-grid">
                                        <div class="metric-item">
                                            <span class="metric-value">${result.results.training.model_count}</span>
                                            <span class="metric-label">学習モデル数</span>
                                        </div>
                                        <div class="metric-item">
                                            <span class="metric-value">${result.results.training.data_count}</span>
                                            <span class="metric-label">学習データ数</span>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${result.results.timeseries_validation ? `
                                <div class="validation-success">
                                    <h5>📊 時系列検証: ${result.results.timeseries_validation.success ? '完了' : '失敗'}</h5>
                                </div>
                            ` : ''}
                            
                            ${result.results.auto_verification ? `
                                <div class="learning-success">
                                    <h5>🧠 自動学習: ${result.results.auto_verification.success ? '完了' : '失敗'}</h5>
                                    ${result.results.auto_verification.verified_count ? `
                                        <p>${result.results.auto_verification.verified_count}件の予測を照合・改善しました</p>
                                    ` : ''}
                                </div>
                            ` : ''}
                            
                            <div class="training-complete">
                                <p class="text-center"><strong>🎉 非同期学習処理が正常に完了しました！</strong></p>
                                <p class="text-center text-muted">予測精度が向上し、次回予測でより良い結果が期待できます。</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        } else {
            const container = document.getElementById('analysis-results');
            if (container) {
                container.innerHTML = `
                    <div class="analysis-card">
                        <div class="empty-state">
                            <div class="empty-icon">❌</div>
                            <div class="empty-title">学習エラー</div>
                            <div class="empty-description">${result.message || '学習に失敗しました'}</div>
                        </div>
                    </div>
                `;
            }
        }
    },
    
    /**
     * 非同期検証結果の表示
     * @param {Object} result - 検証結果
     */
    displayValidationResults(result) {
        if (result.status === 'success') {
            const container = document.getElementById('analysis-results');
            if (container) {
                container.innerHTML = `
                    <div class="validation-results">
                        <div class="analysis-card">
                            <h4>📊 非同期時系列検証完了</h4>
                            <div class="validation-summary">
                                <p>✅ 時系列交差検証が正常に完了しました</p>
                                <p>詳細な結果は今後のアップデートで表示予定です</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        } else {
            const container = document.getElementById('analysis-results');
            if (container) {
                container.innerHTML = `
                    <div class="analysis-card">
                        <div class="empty-state">
                            <div class="empty-icon">❌</div>
                            <div class="empty-title">検証エラー</div>
                            <div class="empty-description">${result.message || '検証に失敗しました'}</div>
                        </div>
                    </div>
                `;
            }
        }
    },
    
    /**
     * システム最適化の実行
     */
    async optimizeSystem() {
        try {
            this.showToast('システム最適化中...', 'info');
            
            const result = await window.api.optimizeSystem();
            
            if (result.status === 'success') {
                const freed = result.data.freed_memory_mb;
                this.showToast(`最適化完了！${freed > 0 ? freed + 'MB解放' : 'メモリクリーンアップ完了'}`, 'success');
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            this.showToast(`最適化エラー: ${error.message}`, 'error');
        }
    },
    
    /**
     * 段階的初期化オプション表示（非同期対応版）
     */
    showSystemInitializationOptions() {
        const container = document.getElementById('prediction-card');
        if (!container) return;
        
        container.innerHTML = `
            <div class="card-header">
                <h2>🎯 予測システム（非同期対応）</h2>
            </div>
            
            <div class="init-options">
                <div class="init-status">
                    <h3>📱 アプリ準備完了</h3>
                    <p>超軽量初期化が完了しました。重い処理は非同期で実行されます。</p>
                    <p>以下のオプションから選択してください：</p>
                </div>
                
                <div class="init-methods">
                    <div class="method-card">
                        <h4>🎲 予測開始（自動初期化）</h4>
                        <p>必要に応じて自動初期化してから予測を実行します</p>
                        <button id="auto-predict-btn" class="btn btn-primary">
                            <span class="btn-icon">🎯</span>
                            予測開始（非同期）
                        </button>
                    </div>
                    
                    <div class="method-card">
                        <h4>⚡ 事前初期化</h4>
                        <p>重いコンポーネントを事前に初期化します</p>
                        <button id="manual-init-btn" class="btn btn-secondary">
                            <span class="btn-icon">🔧</span>
                            事前初期化（非同期）
                        </button>
                    </div>
                    
                    <div class="method-card">
                        <h4>🔧 システム最適化</h4>
                        <p>メモリ使用量を最適化します</p>
                        <button id="optimize-btn" class="btn btn-warning">
                            <span class="btn-icon">💾</span>
                            メモリ最適化
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // イベントリスナー設定
        document.getElementById('auto-predict-btn').addEventListener('click', () => {
            this.getPredictionAsync();
        });
        
        document.getElementById('manual-init-btn').addEventListener('click', () => {
            this.initHeavyComponentsAsync();
        });
        
        document.getElementById('optimize-btn').addEventListener('click', () => {
            this.optimizeSystem();
        });
    },
    
    /**
     * 🔥 重いコンポーネントの非同期初期化
     */
    async initHeavyComponentsAsync() {
        try {
            const taskId = await window.api.initHeavyComponentsAsync(
                // onProgress
                (progress) => {
                    console.log('初期化進捗:', progress);
                },
                // onComplete
                (result) => {
                    this.showToast('初期化が完了しました！', 'success');
                    // システム状態を更新
                    this.loadSystemStatus();
                },
                // onError
                (error) => {
                    console.error('初期化エラー:', error);
                }
            );
            
            this.showProgressModal('重いコンポーネント初期化', taskId,
                (result) => {
                    this.showToast('初期化が完了しました！', 'success');
                    this.loadSystemStatus();
                },
                (error) => {
                    this.showToast(`初期化エラー: ${error.message}`, 'error');
                }
            );
            
        } catch (error) {
            this.showToast(`初期化開始エラー: ${error.message}`, 'error');
        }
    }
});

// 既存のメソッドを非同期版にリダイレクト
Object.assign(UI.prototype, {
    
    /**
     * 予測取得（非同期版に自動リダイレクト）
     */
    async getPrediction() {
        console.log('🔄 getPrediction() -> getPredictionAsync() にリダイレクト');
        return this.getPredictionAsync();
    },
    
    /**
     * モデル学習（非同期版に自動リダイレクト）
     */
    async trainModel() {
        console.log('🔄 trainModel() -> trainModelAsync() にリダイレクト');
        return this.trainModelAsync();
    },
    
    /**
     * 時系列検証（非同期版に自動リダイレクト）
     */
    async runValidation() {
        console.log('🔄 runValidation() -> runValidationAsync() にリダイレクト');
        return this.runValidationAsync();
    },
    
    /**
     * 段階的システム初期化（非同期対応版）
     */
    async initializeSystemProgressively() {
        console.log('🚀 段階的システム初期化開始（非同期対応）');
        
        try {
            // 基本状態確認
            const basicStatus = await window.api.getSystemStatus();
            console.log('✅ 基本システム状態確認完了');
            
            if (basicStatus.status === 'success') {
                this.displayBasicSystemStatus(basicStatus.data);
            }
        } catch (error) {
            console.error('❌ 基本システム状態確認エラー:', error);
            this.showToast('システムの基本確認に失敗しました', 'warning');
        }
        
        // 非同期対応の初期化オプションを表示
        this.showSystemInitializationOptions();
    },
    
    /**
     * 基本システム状態表示
     * @param {Object} statusData - ステータスデータ
     */
    displayBasicSystemStatus(statusData) {
        console.log('基本システム状態:', statusData);
        // 基本状態の表示処理
    }
});

console.log('✅ UI非同期対応機能が追加されました');