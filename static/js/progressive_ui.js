/**
 * 段階的学習UI - ロト7予測PWA
 * 各学習段階を個別に実行・管理
 */

// 既存のUIクラスに段階的学習機能を追加
Object.assign(UI.prototype, {
    
    /**
     * 🔥 段階的学習タブの表示
     */
    async displayProgressiveLearning() {
        const container = document.getElementById('analysis-results');
        if (!container) return;
        
        try {
            // 学習段階情報を取得
            const stagesResponse = await window.api.get('/api/learning/stages');
            const progressResponse = await window.api.get('/api/learning/progress');
            
            if (stagesResponse.status === 'success') {
                this.renderProgressiveLearningUI(stagesResponse.data, progressResponse.data);
            } else {
                throw new Error(stagesResponse.message);
            }
        } catch (error) {
            console.error('段階的学習UI表示エラー:', error);
            container.innerHTML = `
                <div class="analysis-card">
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <div class="empty-title">段階的学習読み込みエラー</div>
                        <div class="empty-description">${error.message}</div>
                    </div>
                </div>
            `;
        }
    },
    
    /**
     * 段階的学習UIのレンダリング
     * @param {Object} stagesData - 段階情報
     * @param {Object} progressData - 進捗情報
     */
    renderProgressiveLearningUI(stagesData, progressData) {
        const container = document.getElementById('analysis-results');
        
        const stages = stagesData.stages || [];
        const progress = progressData?.progress || { completed_stages: 0, total_stages: 5 };
        
        container.innerHTML = `
            <div class="progressive-learning">
                <div class="learning-header">
                    <h3>🎯 段階的学習システム</h3>
                    <div class="learning-progress">
                        <div class="progress-info">
                            <span>進捗: ${progress.completed_stages}/${progress.total_stages} 段階完了</span>
                            <span class="progress-percent">(${Math.round(progress.progress_percentage || 0)}%)</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress.progress_percentage || 0}%"></div>
                        </div>
                    </div>
                </div>
                
                <div class="learning-description">
                    <p>📚 <strong>段階的学習の特徴:</strong></p>
                    <ul>
                        <li>🔬 各検証手法を独立して実行し、処理時間を分散</li>
                        <li>📈 前段階の結果を次段階で活用し、累積的に精度向上</li>
                        <li>⏱️ 必要な段階のみ実行可能で、時間を有効活用</li>
                        <li>🎯 全段階完了後に最適化されたモデルが完成</li>
                    </ul>
                </div>
                
                <div class="learning-stages">
                    ${stages.map(stage => this.createStageCard(stage, progress)).join('')}
                </div>
                
                <div class="learning-controls">
                    <button id="refresh-progress-btn" class="btn btn-secondary">
                        <span class="btn-icon">🔄</span>
                        進捗更新
                    </button>
                    <button id="reset-progress-btn" class="btn btn-warning">
                        <span class="btn-icon">🗑️</span>
                        進捗リセット
                    </button>
                    <button id="run-all-stages-btn" class="btn btn-success">
                        <span class="btn-icon">🚀</span>
                        全段階実行
                    </button>
                </div>
            </div>
        `;
        
        // イベントリスナー設定
        this.setupProgressiveLearningEvents();
    },
    
    /**
     * 学習段階カードの作成
     * @param {Object} stage - 段階情報
     * @param {Object} progress - 進捗情報
     * @returns {string} HTML
     */
    createStageCard(stage, progress) {
        const isCompleted = progress.stages_completed?.includes(stage.id) || false;
        const isLocked = stage.status === 'locked';
        
        const statusIcon = isCompleted ? '✅' : isLocked ? '🔒' : '⏳';
        const statusText = isCompleted ? '完了' : isLocked ? 'ロック中' : '実行可能';
        const statusClass = isCompleted ? 'completed' : isLocked ? 'locked' : 'available';
        
        return `
            <div class="stage-card ${statusClass}">
                <div class="stage-header">
                    <div class="stage-title">
                        <span class="stage-icon">${statusIcon}</span>
                        <h4>${stage.name}</h4>
                        <span class="stage-status">${statusText}</span>
                    </div>
                    <div class="stage-time">${stage.estimated_time}</div>
                </div>
                
                <div class="stage-description">
                    <p>${stage.description}</p>
                </div>
                
                <div class="stage-actions">
                    <button 
                        class="btn ${isCompleted ? 'btn-success' : 'btn-primary'} stage-execute-btn"
                        data-stage-id="${stage.id}"
                        ${isLocked ? 'disabled' : ''}
                    >
                        <span class="btn-icon">${isCompleted ? '🔄' : '▶️'}</span>
                        ${isCompleted ? '再実行' : '実行'}
                    </button>
                    
                    ${isCompleted ? `
                        <button class="btn btn-secondary stage-result-btn" data-stage-id="${stage.id}">
                            <span class="btn-icon">📊</span>
                            結果表示
                        </button>
                    ` : ''}
                </div>
                
                <div class="stage-progress" id="progress-${stage.id}" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="progress-status">準備中...</div>
                </div>
            </div>
        `;
    },
    
    /**
     * 段階的学習のイベントリスナー設定
     */
    setupProgressiveLearningEvents() {
        // 各段階の実行ボタン
        document.querySelectorAll('.stage-execute-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const stageId = e.target.closest('.stage-execute-btn').dataset.stageId;
                this.executeProgressiveLearningStage(stageId);
            });
        });
        
        // 結果表示ボタン
        document.querySelectorAll('.stage-result-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const stageId = e.target.closest('.stage-result-btn').dataset.stageId;
                this.showStageResults(stageId);
            });
        });
        
        // 進捗更新ボタン
        const refreshBtn = document.getElementById('refresh-progress-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.displayProgressiveLearning();
            });
        }
        
        // 進捗リセットボタン
        const resetBtn = document.getElementById('reset-progress-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetProgressiveLearning();
            });
        }
        
        // 全段階実行ボタン
        const runAllBtn = document.getElementById('run-all-stages-btn');
        if (runAllBtn) {
            runAllBtn.addEventListener('click', () => {
                this.runAllProgressiveStages();
            });
        }
    },
    
    /**
     * 🔥 段階的学習の実行
     * @param {string} stageId - 段階ID
     */
    async executeProgressiveLearningStage(stageId) {
        try {
            const confirmed = await this.showConfirmDialog(
                '段階的学習実行',
                `学習段階「${stageId}」を実行します。処理には数分かかる場合があります。続行しますか？`
            );
            
            if (!confirmed) return;
            
            // 段階実行API呼び出し
            const taskId = await window.api.startAsyncTask(`/api/learning/stage/${stageId}`);
            
            // 進捗表示
            this.showStageProgress(stageId, taskId);
            
        } catch (error) {
            this.showToast(`段階実行エラー: ${error.message}`, 'error');
        }
    },
    
    /**
     * 段階の進捗表示
     * @param {string} stageId - 段階ID
     * @param {string} taskId - タスクID
     */
    showStageProgress(stageId, taskId) {
        const progressEl = document.getElementById(`progress-${stageId}`);
        const btn = document.querySelector(`[data-stage-id="${stageId}"]`);
        
        if (progressEl) progressEl.style.display = 'block';
        if (btn) btn.disabled = true;
        
        // ポーリング開始
        window.api.pollTaskStatus(
            taskId,
            // onProgress
            (progress) => {
                this.updateStageProgress(stageId, progress);
            },
            // onComplete
            (result) => {
                this.onStageComplete(stageId, result);
                if (progressEl) progressEl.style.display = 'none';
                if (btn) btn.disabled = false;
            },
            // onError
            (error) => {
                this.showToast(`段階 ${stageId} でエラー: ${error.message}`, 'error');
                if (progressEl) progressEl.style.display = 'none';
                if (btn) btn.disabled = false;
            }
        );
    },
    
    /**
     * 段階進捗の更新
     * @param {string} stageId - 段階ID
     * @param {Object} progress - 進捗情報
     */
    updateStageProgress(stageId, progress) {
        const progressEl = document.getElementById(`progress-${stageId}`);
        if (!progressEl) return;
        
        const fillEl = progressEl.querySelector('.progress-fill');
        const statusEl = progressEl.querySelector('.progress-status');
        
        if (fillEl) fillEl.style.width = `${progress.progress || 0}%`;
        if (statusEl) statusEl.textContent = progress.status || '処理中...';
    },
    
    /**
     * 段階完了時の処理
     * @param {string} stageId - 段階ID
     * @param {Object} result - 結果
     */
    onStageComplete(stageId, result) {
        if (result.status === 'success') {
            this.showToast(`段階 ${stageId} が完了しました！`, 'success');
            
            // 段階カードを更新
            const stageCard = document.querySelector(`[data-stage-id="${stageId}"]`).closest('.stage-card');
            if (stageCard) {
                stageCard.classList.remove('available');
                stageCard.classList.add('completed');
                
                const statusIcon = stageCard.querySelector('.stage-icon');
                const statusText = stageCard.querySelector('.stage-status');
                
                if (statusIcon) statusIcon.textContent = '✅';
                if (statusText) statusText.textContent = '完了';
                
                // 結果表示ボタンを追加
                const actionsEl = stageCard.querySelector('.stage-actions');
                if (actionsEl && !actionsEl.querySelector('.stage-result-btn')) {
                    const resultBtn = document.createElement('button');
                    resultBtn.className = 'btn btn-secondary stage-result-btn';
                    resultBtn.dataset.stageId = stageId;
                    resultBtn.innerHTML = '<span class="btn-icon">📊</span>結果表示';
                    resultBtn.addEventListener('click', () => this.showStageResults(stageId));
                    actionsEl.appendChild(resultBtn);
                }
            }
            
            // 全体進捗を更新
            this.updateOverallProgress(result.learning_progress);
            
        } else {
            this.showToast(`段階 ${stageId} でエラーが発生しました`, 'error');
        }
    },
    
    /**
     * 全体進捗の更新
     * @param {Object} progressInfo - 進捗情報
     */
    updateOverallProgress(progressInfo) {
        if (!progressInfo) return;
        
        const progressFill = document.querySelector('.learning-progress .progress-fill');
        const progressInfo_el = document.querySelector('.learning-progress .progress-info span');
        const progressPercent = document.querySelector('.learning-progress .progress-percent');
        
        if (progressFill) {
            progressFill.style.width = `${progressInfo.progress_percentage || 0}%`;
        }
        
        if (progressInfo_el) {
            progressInfo_el.textContent = `進捗: ${progressInfo.completed_stages}/${progressInfo.total_stages} 段階完了`;
        }
        
        if (progressPercent) {
            progressPercent.textContent = `(${Math.round(progressInfo.progress_percentage || 0)}%)`;
        }
    },
    
    /**
     * 段階結果の表示
     * @param {string} stageId - 段階ID
     */
    showStageResults(stageId) {
        // 結果表示モーダル（簡易版）
        const content = `
            <div class="stage-results">
                <h4>段階 ${stageId} の結果</h4>
                <p>この段階の詳細な結果表示は今後のアップデートで実装予定です。</p>
                <p>現在は学習が正常に完了し、モデルに反映されています。</p>
            </div>
        `;
        
        this.showModal('学習結果', content, [
            { text: '閉じる', class: 'btn-primary' }
        ]);
    },
    
    /**
     * 進捗リセット
     */
    async resetProgressiveLearning() {
        try {
            const confirmed = await this.showConfirmDialog(
                '進捗リセット',
                '学習進捗をリセットします。全ての段階が未実行状態に戻ります。続行しますか？'
            );
            
            if (!confirmed) return;
            
            const taskId = await window.api.startAsyncTask('/api/learning/reset');
            
            this.showProgressModal('進捗リセット中', taskId,
                (result) => {
                    this.showToast('学習進捗をリセットしました', 'success');
                    this.displayProgressiveLearning(); // UI更新
                },
                (error) => {
                    this.showToast(`リセットエラー: ${error.message}`, 'error');
                }
            );
            
        } catch (error) {
            this.showToast(`リセット開始エラー: ${error.message}`, 'error');
        }
    },
    
    /**
     * 全段階実行
     */
    async runAllProgressiveStages() {
        try {
            const confirmed = await this.showConfirmDialog(
                '全段階実行',
                '全ての学習段階を順次実行します。完了まで30-60分かかる場合があります。続行しますか？'
            );
            
            if (!confirmed) return;
            
            // 段階を順次実行
            const stages = ['stage1_fixed_10', 'stage2_fixed_20', 'stage3_fixed_30', 'stage4_expanding', 'stage5_ensemble'];
            
            for (const stageId of stages) {
                try {
                    this.showToast(`段階 ${stageId} を開始します...`, 'info');
                    await this.executeProgressiveLearningStage(stageId);
                    
                    // 次の段階までの待機時間
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    this.showToast(`段階 ${stageId} でエラー: ${error.message}`, 'error');
                    break;
                }
            }
            
        } catch (error) {
            this.showToast(`全段階実行エラー: ${error.message}`, 'error');
        }
    }
});

// 分析タブの loadAnalysisData を段階的学習対応に更新
Object.assign(UI.prototype, {
    
    /**
     * 分析データの読み込み（段階的学習対応版）
     */
    async loadAnalysisData() {
        try {
            // 最近の抽選結果を読み込み
            await this.loadRecentResults();
            
            // 段階的学習UIを表示
            await this.displayProgressiveLearning();
            
        } catch (error) {
            console.error('分析データ読み込みエラー:', error);
            this.displayAnalysisError(error.message);
        }
    }
});

console.log('✅ 段階的学習UI機能が追加されました');