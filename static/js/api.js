/**
 * API通信クラス - ロト7予測PWA（非同期対応版）
 * 長時間処理をタスクベースで管理
 */

class API {
    constructor() {
        this.baseURL = window.location.origin;
        this.isOnline = navigator.onLine;
        this.requestCount = 0;
        this.activePolling = new Map(); // アクティブなポーリング管理
        
        console.log('API class initialized with baseURL:', this.baseURL);
        
        // オンライン/オフライン状態の監視
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.onConnectionChange(true);
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.onConnectionChange(false);
        });
    }
    
    /**
     * 接続状態変更時のコールバック
     */
    onConnectionChange(online) {
        if (window.ui) {
            window.ui.updateConnectionStatus(online);
        }
    }
    
    /**
     * APIリクエストの共通処理
     */
    async request(endpoint, options = {}) {
        if (!this.isOnline && !options.allowOffline) {
            throw new Error('オフライン状態です。インターネット接続を確認してください。');
        }
        
        const requestId = ++this.requestCount;
        const url = `${this.baseURL}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'same-origin'
        };
        
        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };
        
        try {
            console.log(`[API ${requestId}] ${finalOptions.method || 'GET'} ${url}`);
            
            const response = await fetch(url, finalOptions);
            
            if (!response.ok) {
                let errorMessage;
                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const errorData = await response.json();
                        errorMessage = errorData.message || `API Error: ${response.status}`;
                    } else {
                        const text = await response.text();
                        errorMessage = text || `API Error: ${response.status}`;
                    }
                } catch (e) {
                    errorMessage = `API Error: ${response.status} ${response.statusText}`;
                }
                
                const error = new Error(errorMessage);
                error.status = response.status;
                throw error;
            }
            
            const data = await response.json();
            console.log(`[API ${requestId}] Success:`, data);
            
            return data;
            
        } catch (error) {
            console.error(`[API ${requestId}] Request failed:`, error);
            
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                throw new Error('ネットワークエラー: サーバーに接続できません');
            }
            
            throw error;
        }
    }
    
    /**
     * 🔥 非同期タスクの開始
     * @param {string} endpoint - エンドポイント
     * @param {Object} data - リクエストデータ
     * @returns {Promise<string>} タスクID
     */
    async startAsyncTask(endpoint, data = {}) {
        const response = await this.post(endpoint, data);
        
        if (response.status === 'success' && response.data.task_id) {
            return response.data.task_id;
        } else {
            throw new Error(response.message || 'タスクの開始に失敗しました');
        }
    }
    
    /**
     * 🔥 タスクの状態をポーリング
     * @param {string} taskId - タスクID
     * @param {Function} onProgress - 進捗コールバック
     * @param {Function} onComplete - 完了コールバック
     * @param {Function} onError - エラーコールバック
     * @param {number} pollInterval - ポーリング間隔（ミリ秒）
     */
    async pollTaskStatus(taskId, onProgress, onComplete, onError, pollInterval = 2000) {
        // 既存のポーリングがあれば停止
        this.stopPolling(taskId);
        
        const poll = async () => {
            try {
                const response = await this.get(`/api/task/${taskId}`);
                
                if (response.status === 'success') {
                    const taskStatus = response.data;
                    
                    switch (taskStatus.state) {
                        case 'PENDING':
                            onProgress && onProgress({
                                progress: 0,
                                status: taskStatus.status || 'タスク開始待ち...'
                            });
                            break;
                            
                        case 'PROGRESS':
                            onProgress && onProgress({
                                progress: taskStatus.progress || 0,
                                current: taskStatus.current || 0,
                                total: taskStatus.total || 1,
                                status: taskStatus.status || '処理中...'
                            });
                            break;
                            
                        case 'SUCCESS':
                            this.stopPolling(taskId);
                            onComplete && onComplete(taskStatus.result);
                            return; // ポーリング終了
                            
                        case 'FAILURE':
                            this.stopPolling(taskId);
                            onError && onError(new Error(taskStatus.error || 'タスクでエラーが発生しました'));
                            return; // ポーリング終了
                    }
                } else {
                    throw new Error(response.message || 'タスク状態の取得に失敗しました');
                }
                
                // 次のポーリングをスケジュール
                const timeoutId = setTimeout(poll, pollInterval);
                this.activePolling.set(taskId, timeoutId);
                
            } catch (error) {
                console.error(`タスク状態確認エラー (${taskId}):`, error);
                this.stopPolling(taskId);
                onError && onError(error);
            }
        };
        
        // 初回ポーリング実行
        poll();
    }
    
    /**
     * ポーリングを停止
     * @param {string} taskId - タスクID
     */
    stopPolling(taskId) {
        const timeoutId = this.activePolling.get(taskId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.activePolling.delete(taskId);
        }
    }
    
    /**
     * 🔥 タスクをキャンセル
     * @param {string} taskId - タスクID
     */
    async cancelTask(taskId) {
        this.stopPolling(taskId);
        return this.post(`/api/task/${taskId}/cancel`);
    }
    
    /**
     * GETリクエスト
     */
    async get(endpoint, params = {}) {
        const url = new URL(endpoint, this.baseURL);
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });
        
        return this.request(url.pathname + url.search);
    }
    
    /**
     * POSTリクエスト
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    /**
     * ファイルアップロード
     */
    async uploadFile(endpoint, file) {
        const formData = new FormData();
        formData.append('file', file);
        
        return this.request(endpoint, {
            method: 'POST',
            headers: {}, // Content-Typeを設定しない
            body: formData
        });
    }
    
    /**
     * ファイルダウンロード
     */
    async downloadFile(endpoint) {
        const response = await fetch(`${this.baseURL}${endpoint}`);
        
        if (!response.ok) {
            throw new Error(`ダウンロードに失敗しました: ${response.statusText}`);
        }
        
        return response.blob();
    }
    
    // === 🔥 非同期対応API ===
    
    /**
     * システム状態を取得
     */
    async getSystemStatus() {
        return this.get('/?api=true');
    }
    
    /**
     * 詳細ステータスを取得
     */
    async getDetailedStatus() {
        return this.get('/api/status');
    }
    
    /**
     * 🔥 重いコンポーネントの非同期初期化
     * @param {Function} onProgress - 進捗コールバック
     * @param {Function} onComplete - 完了コールバック
     * @param {Function} onError - エラーコールバック
     */
    async initHeavyComponentsAsync(onProgress, onComplete, onError) {
        try {
            const taskId = await this.startAsyncTask('/api/init_heavy');
            
            this.pollTaskStatus(
                taskId,
                onProgress,
                (result) => {
                    console.log('重いコンポーネント初期化完了:', result);
                    onComplete && onComplete(result);
                },
                onError
            );
            
            return taskId;
        } catch (error) {
            onError && onError(error);
            throw error;
        }
    }
    
    /**
     * 🔥 非同期予測取得
     * @param {Function} onProgress - 進捗コールバック
     * @param {Function} onComplete - 完了コールバック
     * @param {Function} onError - エラーコールバック
     */
    async getPredictionAsync(onProgress, onComplete, onError) {
        try {
            const taskId = await this.startAsyncTask('/api/predict');
            
            this.pollTaskStatus(
                taskId,
                onProgress,
                (result) => {
                    console.log('予測生成完了:', result);
                    onComplete && onComplete(result);
                },
                onError
            );
            
            return taskId;
        } catch (error) {
            onError && onError(error);
            throw error;
        }
    }
    
    /**
     * 🔥 非同期モデル学習
     * @param {Object} options - 学習オプション
     * @param {Function} onProgress - 進捗コールバック
     * @param {Function} onComplete - 完了コールバック
     * @param {Function} onError - エラーコールバック
     */
    async trainModelAsync(options = {}, onProgress, onComplete, onError) {
        try {
            const defaultOptions = {
                force_full_train: false,
                run_timeseries_validation: true,
                run_auto_verification: true
            };
            
            const taskId = await this.startAsyncTask('/api/train', { ...defaultOptions, ...options });
            
            this.pollTaskStatus(
                taskId,
                onProgress,
                (result) => {
                    console.log('モデル学習完了:', result);
                    onComplete && onComplete(result);
                },
                onError
            );
            
            return taskId;
        } catch (error) {
            onError && onError(error);
            throw error;
        }
    }
    
    /**
     * 🔥 非同期時系列検証
     * @param {Function} onProgress - 進捗コールバック
     * @param {Function} onComplete - 完了コールバック
     * @param {Function} onError - エラーコールバック
     */
    async runValidationAsync(onProgress, onComplete, onError) {
        try {
            const taskId = await this.startAsyncTask('/api/validation');
            
            this.pollTaskStatus(
                taskId,
                onProgress,
                (result) => {
                    console.log('時系列検証完了:', result);
                    onComplete && onComplete(result);
                },
                onError
            );
            
            return taskId;
        } catch (error) {
            onError && onError(error);
            throw error;
        }
    }
    
    // === 軽量同期API（継続使用可能） ===
    
    /**
     * 最近の抽選結果を取得（同期・軽量）
     */
    async getRecentResults(count = 5) {
        return this.get('/api/recent_results', { count });
    }
    
    /**
     * モデルファイルをダウンロード
     */
    async downloadModel() {
        return this.downloadFile('/api/download/model.pkl');
    }
    
    /**
     * 履歴ファイルをダウンロード
     */
    async downloadHistory() {
        return this.downloadFile('/api/download/prediction_history.csv');
    }
    
    /**
     * データファイルをダウンロード
     */
    async downloadData() {
        return this.downloadFile('/api/download/loto7_data.csv');
    }
    
    /**
     * モデルファイルをアップロード
     */
    async uploadModel(file) {
        return this.uploadFile('/api/upload/model.pkl', file);
    }
    
    /**
     * 履歴ファイルをアップロード
     */
    async uploadHistory(file) {
        return this.uploadFile('/api/upload/prediction_history.csv', file);
    }
    
    /**
     * データファイルをアップロード
     */
    async uploadData(file) {
        return this.uploadFile('/api/upload/loto7_data.csv', file);
    }
    
    /**
     * システム最適化実行
     */
    async optimizeSystem() {
        return this.post('/api/optimize');
    }
    
    // === 後方互換性のための同期API（非推奨） ===
    
    /**
     * @deprecated 非同期版を使用してください: getPredictionAsync()
     */
    async getPrediction() {
        console.warn('⚠️ getPrediction() は非推奨です。getPredictionAsync() を使用してください。');
        return this.get('/api/predict?async=false');
    }
    
    /**
     * @deprecated 非同期版を使用してください: trainModelAsync()
     */
    async trainModel(options = {}) {
        console.warn('⚠️ trainModel() は非推奨です。trainModelAsync() を使用してください。');
        return this.post('/api/train', options);
    }
}

// グローバル定義
window.API = API;
window.api = new API();

console.log('✅ API クラス定義完了（非同期対応版）:', typeof API);
console.log('✅ グローバルAPI インスタンス作成完了:', typeof window.api);