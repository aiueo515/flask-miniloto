/**
 * 分析機能実装 - ロト7予測PWA
 * 分析タブと学習機能の実装
 */

// UIクラスが確実に読み込まれるまで待機
function waitForUIForAnalysis() {
    return new Promise((resolve) => {
        function checkUI() {
            if (window.UI && typeof window.UI === 'function' && window.UI.prototype) {
                console.log('✅ analysis.js: UI クラス確認完了');
                resolve(true);
                return;
            }
            
            console.log('⏳ analysis.js: UI クラス待機中...');
            setTimeout(checkUI, 50);
        }
        
        checkUI();
    });
}

// UI クラスが利用可能になってから拡張を実行
waitForUIForAnalysis().then(() => {
    
    // UI クラスの分析機能を拡張
    Object.assign(window.UI.prototype, {
        
        /**
         * 分析データの読み込み
         */
        async loadAnalysisData() {
            try {
                // 最近の抽選結果を読み込み
                await this.loadRecentResults();
                
                // 現在の分析状態を表示
                this.displayAnalysisStatus();
            } catch (error) {
                console.error('分析データ読み込みエラー:', error);
                this.displayAnalysisError(error.message);
            }
        },
        
        /**
         * 最近の抽選結果読み込み
         */
        async loadRecentResults() {
            try {
                const results = await window.api.getRecentResults(10);
                
                if (results.status === 'success') {
                    this.displayRecentResults(results.data);
                } else {
                    throw new Error(results.message || '抽選結果の取得に失敗しました');
                }
            } catch (error) {
                console.error('抽選結果読み込みエラー:', error);
                this.displayRecentResultsError(error.message);
            }
        },
        
        /**
         * 最近の抽選結果表示
         * @param {Object} resultsData - 抽選結果データ
         */
        displayRecentResults(resultsData) {
            const container = document.getElementById('recent-results-list');
            if (!container) return;
            
            if (!resultsData.results || resultsData.results.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🎱</div>
                        <div class="empty-title">抽選結果なし</div>
                        <div class="empty-description">抽選結果データがありません</div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = `
                <div class="results-header">
                    <h4>最近の抽選結果 (${resultsData.count}件)</h4>
                    <p class="text-muted">最新: 第${resultsData.latest_round}回まで</p>
                </div>
                <div class="results-list">
                    ${resultsData.results.map(result => `
                        <div class="result-item">
                            <div class="result-header">
                                <div class="round-info">
                                    <span class="round-number">第${result.round}回</span>
                                    <span class="round-date">${result.date}</span>
                                </div>
                            </div>
                            <div class="result-numbers">
                                <div class="main-numbers">
                                    <span class="numbers-label">本数字:</span>
                                    <div class="numbers-container">
                                        ${result.main_numbers.map(num => `
                                            <span class="number-ball">${num}</span>
                                        `).join('')}
                                    </div>
                                </div>
                                ${result.bonus_numbers && result.bonus_numbers.length > 0 ? `
                                    <div class="bonus-numbers">
                                        <span class="numbers-label">ボーナス:</span>
                                        <div class="numbers-container">
                                            ${result.bonus_numbers.map(num => `
                                                <span class="number-ball bonus">${num}</span>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        },
        
        /**
         * 抽選結果エラー表示
         * @param {string} errorMessage - エラーメッセージ
         */
        displayRecentResultsError(errorMessage) {
            const container = document.getElementById('recent-results-list');
            if (!container) return;
            
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">抽選結果読み込みエラー</div>
                    <div class="error-message">${errorMessage}</div>
                    <button class="btn btn-primary" onclick="window.ui.loadRecentResults()">
                        再試行
                    </button>
                </div>
            `;
        },
        
        /**
         * 分析状態の表示
         */
        displayAnalysisStatus() {
            const container = document.getElementById('analysis-results');
            if (!container) return;
            
            container.innerHTML = `
                <div class="analysis-status">
                    <div class="status-card">
                        <h4>🔍 分析機能</h4>
                        <p>時系列交差検証と自動学習改善を実行できます。</p>
                        <div class="analysis-info">
                            <div class="info-item">
                                <span class="info-label">時系列検証:</span>
                                <span class="info-value">固定窓・累積窓での予測精度検証</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">学習改善:</span>
                                <span class="info-value">過去結果との照合による自動学習</span>
                            </div>
                        </div>
                        <div class="analysis-controls">
                            <button class="btn btn-primary" onclick="window.ui.runValidationAsync()">
                                🔍 時系列検証実行
                            </button>
                            <button class="btn btn-secondary" onclick="window.ui.runAutoLearningAsync()">
                                📚 自動学習実行
                            </button>
                        </div>
                    </div>
                </div>
            `;
        },
        
        /**
         * 分析エラー表示
         * @param {string} errorMessage - エラーメッセージ
         */
        displayAnalysisError(errorMessage) {
            const container = document.getElementById('analysis-results');
            if (!container) return;
            
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">分析データ読み込みエラー</div>
                    <div class="error-message">${errorMessage}</div>
                    <button class="btn btn-primary" onclick="window.ui.loadAnalysisData()">
                        再試行
                    </button>
                </div>
            `;
        },
        
        /**
         * 検証結果の表示
         * @param {Object} validationData - 検証データ
         */
        displayValidationResults(validationData) {
            const container = document.getElementById('analysis-results');
            if (!container) return;
            
            const results = validationData.validation_results;
            
            let content = `
                <div class="validation-results">
                    <div class="results-header">
                        <h4>🔍 時系列検証結果</h4>
                        <p class="text-muted">検証完了: ${new Date().toLocaleString('ja-JP')}</p>
                    </div>
                    
                    <div class="validation-summary">
                        <div class="metric-grid">
                            <div class="metric-item">
                                <span class="metric-value">${results.avg_accuracy?.toFixed(2) || 'N/A'}</span>
                                <span class="metric-label">平均精度</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-value">${results.total_tests || 0}</span>
                                <span class="metric-label">検証回数</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-value">${results.best_accuracy?.toFixed(2) || 'N/A'}</span>
                                <span class="metric-label">最高精度</span>
                            </div>
                        </div>
                    </div>
            `;
            
            if (results.window_results) {
                content += this.createWindowResultsSection(results.window_results);
            }
            
            content += `
                </div>
            `;
            
            container.innerHTML = content;
        },
        
        /**
         * 窓検証結果セクションの作成
         * @param {Object} windowResults - 窓検証結果
         * @returns {string} HTML
         */
        createWindowResultsSection(windowResults) {
            let content = '<div class="window-results">';
            
            Object.entries(windowResults).forEach(([windowSize, results]) => {
                const avgAccuracy = results.reduce((sum, r) => sum + (r.accuracy || 0), 0) / results.length;
                const maxAccuracy = Math.max(...results.map(r => r.accuracy || 0));
                
                content += `
                    <div class="window-result-item">
                        <div class="window-header">
                            <h5>${windowSize}回分窓検証</h5>
                            <span class="window-stats">
                                平均: ${avgAccuracy.toFixed(2)} | 最高: ${maxAccuracy.toFixed(2)}
                            </span>
                        </div>
                        <div class="window-details">
                            検証回数: ${results.length}回
                        </div>
                    </div>
                `;
            });
            
            content += '</div>';
            return content;
        },
        
        /**
         * 自動学習結果の表示
         * @param {Object} learningData - 学習データ
         */
        displayAutoLearningResults(learningData) {
            const container = document.getElementById('analysis-results');
            if (!container) return;
            
            const autoVerification = learningData.auto_verification_results;
            
            let content = `
                <div class="learning-results">
                    <div class="results-header">
                        <h4>📚 自動学習結果</h4>
                        <p class="text-muted">学習完了: ${new Date().toLocaleString('ja-JP')}</p>
                    </div>
            `;
            
            if (autoVerification && autoVerification.verified_count > 0) {
                content += `
                    <div class="learning-summary">
                        <div class="metric-grid">
                            <div class="metric-item">
                                <span class="metric-value">${autoVerification.verified_count}</span>
                                <span class="metric-label">照合済み予測数</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-value">${Object.keys(autoVerification.improvements || {}).length}</span>
                                <span class="metric-label">改善項目数</span>
                            </div>
                        </div>
                        
                        ${this.createLearningImprovements(autoVerification.improvements)}
                    </div>
                `;
            } else {
                content += `
                    <div class="learning-summary">
                        <div class="empty-state">
                            <div class="empty-icon">🔍</div>
                            <div class="empty-title">照合データなし</div>
                            <div class="empty-description">新しい照合可能な予測がありませんでした</div>
                        </div>
                    </div>
                `;
            }
            
            content += `
                </div>
            `;
            
            container.innerHTML = content;
        },
        
        /**
         * 学習改善内容の生成
         * @param {Object} improvements - 改善データ
         * @returns {string} HTML
         */
        createLearningImprovements(improvements) {
            if (!improvements || Object.keys(improvements).length === 0) {
                return '<p class="text-muted">改善項目はありませんでした</p>';
            }
            
            let content = '<div class="improvements-list">';
            
            // 高精度パターン学習
            if (improvements.high_accuracy_patterns) {
                const patterns = improvements.high_accuracy_patterns;
                content += `
                    <div class="improvement-item">
                        <h6>🎯 高精度パターン学習</h6>
                        <div class="improvement-details">
                            <div class="pattern-stats">
                                <div class="stat-item">
                                    <span class="stat-label">理想的な合計値:</span>
                                    <span class="stat-value">${patterns.ideal_sum}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">理想的な奇数個数:</span>
                                    <span class="stat-value">${patterns.ideal_odd_count}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">学習サンプル数:</span>
                                    <span class="stat-value">${patterns.sample_size}件</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // 避けるべきパターン学習
            if (improvements.avoid_patterns) {
                const avoidPatterns = improvements.avoid_patterns;
                content += `
                    <div class="improvement-item">
                        <h6>⚠️ 避けるべきパターン学習</h6>
                        <div class="improvement-details">
                            <div class="avoid-patterns">
                                <div class="stat-item">
                                    <span class="stat-label">低精度な合計値範囲:</span>
                                    <span class="stat-value">${avoidPatterns.bad_sum_range?.join(' - ')}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">避けるべき数字:</span>
                                    <span class="stat-value">${avoidPatterns.frequent_misses?.join(', ')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            content += '</div>';
            return content;
        },
        
        /**
         * 検証エラー表示
         * @param {string} errorMessage - エラーメッセージ
         */
        displayValidationError(errorMessage) {
            const container = document.getElementById('analysis-results');
            if (container) {
                container.innerHTML = `
                    <div class="analysis-card">
                        <div class="empty-state">
                            <div class="empty-icon">⚠️</div>
                            <div class="empty-title">検証エラー</div>
                            <div class="empty-description">${errorMessage}</div>
                        </div>
                    </div>
                `;
            }
        },
        
        /**
         * 学習エラー表示
         * @param {string} errorMessage - エラーメッセージ
         */
        displayLearningError(errorMessage) {
            const container = document.getElementById('analysis-results');
            if (container) {
                container.innerHTML = `
                    <div class="analysis-card">
                        <div class="empty-state">
                            <div class="empty-icon">⚠️</div>
                            <div class="empty-title">学習エラー</div>
                            <div class="empty-description">${errorMessage}</div>
                        </div>
                    </div>
                `;
            }
        },
        
        /**
         * 学習エラー表示（重複だが元ファイルにあったため残す）
         * @param {string} errorMessage - エラーメッセージ
         */
        displayTrainingError(errorMessage) {
            const container = document.getElementById('analysis-results');
            if (container) {
                container.innerHTML = `
                    <div class="analysis-card">
                        <div class="empty-state">
                            <div class="empty-icon">⚠️</div>
                            <div class="empty-title">学習エラー</div>
                            <div class="empty-description">${errorMessage}</div>
                        </div>
                    </div>
                `;
            }
        }
    });
    
    console.log('✅ 分析機能UI拡張完了（完全版）');
    
}).catch((error) => {
    console.error('❌ 分析機能拡張エラー:', error);
});