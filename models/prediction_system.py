"""
高度統合予測システム - ミニロト対応版
自動取得、学習、予測を統合
"""

import numpy as np
import pandas as pd
import logging
from collections import Counter
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score

from .data_fetcher import AutoDataFetcher
from .prediction_history import RoundAwarePredictionHistory
from .learning import AutoVerificationLearner
from .validation import TimeSeriesCrossValidator

logger = logging.getLogger(__name__)

class AutoFetchEnsembleMiniLoto:
    """高度統合予測システム（ミニロト対応版）"""
    
    def __init__(self):
        logger.info("AutoFetchEnsembleMiniLoto初期化")
        
        # データ取得器（ミニロト対応）
        self.data_fetcher = AutoDataFetcher()
        
        # 複数モデル（そのまま使用可能）
        self.models = {
            'random_forest': RandomForestClassifier(
                n_estimators=100, max_depth=12, random_state=42, n_jobs=-1
            ),
            'gradient_boost': GradientBoostingClassifier(
                n_estimators=80, max_depth=8, random_state=42
            ),
            'neural_network': MLPClassifier(
                hidden_layer_sizes=(128, 64, 32), max_iter=300, random_state=42
            )
        }
        
        self.scalers = {}
        self.model_weights = {
            'random_forest': 0.4,
            'gradient_boost': 0.35,
            'neural_network': 0.25
        }
        
        # データ分析
        self.freq_counter = Counter()
        self.pair_freq = Counter()
        self.pattern_stats = {}
        
        # 学習状態
        self.trained_models = {}
        self.model_scores = {}
        self.data_count = 0
        
        # 開催回対応予測履歴
        self.history = RoundAwarePredictionHistory()
        
        # 時系列検証器（第2段階）
        self.validator = None
        
        # 自動照合学習器（第3段階）
        self.auto_learner = AutoVerificationLearner()
        
        # ファイル管理器（外部から設定）
        self.file_manager = None
        
        logger.info("初期化完了 - ミニロト自動データ取得システム")
        
    def set_file_manager(self, file_manager):
        """ファイル管理器を設定"""
        self.file_manager = file_manager
        
        # 各コンポーネントにも設定
        self.data_fetcher.set_cache_manager(file_manager)
        self.history.set_file_manager(file_manager)
        
    def load_models(self):
        """保存済みモデルと統計情報を読み込み"""
        if not self.file_manager:
            logger.warning("ファイル管理器が設定されていません")
            return False
            
        return self.file_manager.load_model(self)
    
    def save_models(self):
        """学習済みモデルと統計情報を保存"""
        if not self.file_manager:
            logger.warning("ファイル管理器が設定されていません")
            return False
            
        return self.file_manager.save_model(self)
    
    def auto_setup_and_train(self, force_full_train=False):
        """自動セットアップ・学習"""
        try:
            logger.info("=== ミニロト自動セットアップ・学習開始 ===")
            
            # 1. 最新データ取得
            if not self.data_fetcher.fetch_latest_data():
                logger.error("データ取得失敗")
                return False
            
            training_data = self.data_fetcher.get_data_for_training()
            
            # 2. 保存済みモデルの確認
            if not force_full_train and self.file_manager and self.file_manager.model_exists():
                if self.load_models():
                    logger.info("保存済みモデルを使用")
                    
                    # 差分学習が必要かチェック
                    if self.data_count < len(training_data):
                        logger.info(f"差分学習を実行: {len(training_data) - self.data_count}件の新規データ")
                        # 新規学習を実行
                        success = self.train_ensemble_models(training_data)
                        if success and self.file_manager:
                            self.save_models()
                        return success
                    else:
                        logger.info("モデルは最新です")
                        return True
            
            logger.info("新規学習を実行")
            
            # 3. 過去の予測と自動照合
            verified_count = self.history.auto_verify_with_data(
                training_data, 
                self.data_fetcher.round_column,
                self.data_fetcher.main_columns
            )
            
            if verified_count > 0:
                logger.info(f"{verified_count}件の過去予測を自動照合・学習に反映")
            
            # 4. 学習実行
            success = self.train_ensemble_models(training_data)
            if not success:
                logger.error("学習失敗")
                return False
            
            # 5. モデル保存
            if self.file_manager:
                self.save_models()
            
            logger.info("ミニロト自動セットアップ・学習完了")
            return True
            
        except Exception as e:
            logger.error(f"自動セットアップエラー: {e}")
            return False
    
    def train_ensemble_models(self, data):
        """アンサンブルモデル学習（ミニロト対応）"""
        try:
            logger.info("=== ミニロトアンサンブル学習開始 ===")
            
            # 実際のカラム名を使用
            main_cols = self.data_fetcher.main_columns
            
            # ミニロト用特徴量作成
            X, y = self.create_advanced_features(data, main_cols)
            if X is None or len(X) < 100:
                logger.error(f"特徴量不足: {len(X) if X is not None else 0}件")
                return False
            
            self.data_count = len(data)
            
            # 各モデルの学習
            logger.info("ミニロトアンサンブルモデル学習中...")
            
            for name, model in self.models.items():
                try:
                    logger.info(f"  {name} 学習中...")
                    
                    # スケーリング
                    scaler = StandardScaler()
                    X_scaled = scaler.fit_transform(X)
                    self.scalers[name] = scaler
                    
                    # 学習
                    model.fit(X_scaled, y)
                    
                    # クロスバリデーション評価
                    cv_score = np.mean(cross_val_score(model, X_scaled, y, cv=3))
                    
                    self.trained_models[name] = model
                    self.model_scores[name] = cv_score
                    
                    logger.info(f"    ✅ {name}: CV精度 {cv_score*100:.2f}%")
                    
                except Exception as e:
                    logger.error(f"    ❌ {name}: エラー {e}")
                    continue
            
            logger.info(f"ミニロトアンサンブル学習完了: {len(self.trained_models)}モデル")
            return True
            
        except Exception as e:
            logger.error(f"アンサンブル学習エラー: {str(e)}")
            return False
    
    def create_advanced_features(self, data, main_cols):
        """ミニロト用高度な特徴量エンジニアリング"""
        try:
            logger.info("ミニロト用特徴量エンジニアリング開始")
            
            features = []
            targets = []
            
            for i in range(len(data)):
                try:
                    current = []
                    for col in main_cols:
                        if col in data.columns:
                            current.append(int(data.iloc[i][col]))
                    
                    if len(current) != 5:  # ミニロトは5個
                        continue
                    
                    if not all(1 <= x <= 31 for x in current):  # ミニロト範囲：1-31
                        continue
                    if len(set(current)) != 5:  # 重複チェック
                        continue
                    
                    # 基本統計
                    for num in current:
                        self.freq_counter[num] += 1
                    
                    # ペア分析
                    for j in range(len(current)):
                        for k in range(j+1, len(current)):
                            pair = tuple(sorted([current[j], current[k]]))
                            self.pair_freq[pair] += 1
                    
                    # ミニロト用特徴量（14次元）
                    sorted_nums = sorted(current)
                    gaps = [sorted_nums[j+1] - sorted_nums[j] for j in range(4)]  # 4個のギャップ
                    
                    feat = [
                        float(np.mean(current)),           # 平均
                        float(np.std(current)),            # 標準偏差
                        float(np.sum(current)),            # 合計
                        float(sum(1 for x in current if x % 2 == 1)),  # 奇数数
                        float(max(current)),               # 最大値
                        float(min(current)),               # 最小値
                        float(np.median(current)),         # 中央値
                        float(max(current) - min(current)), # 範囲
                        float(len([j for j in range(len(sorted_nums)-1) 
                                 if sorted_nums[j+1] - sorted_nums[j] == 1])), # 連続数
                        float(current[0]),                 # 第1数字
                        float(current[2]),                 # 第3数字（中央）
                        float(current[4]),                 # 第5数字
                        float(np.mean(gaps)),              # 平均ギャップ
                        float(max(gaps)),                  # 最大ギャップ
                        float(min(gaps)),                  # 最小ギャップ
                        float(sum(1 for x in current if x <= 15))  # 前半数（31の約半分）
                    ]
                    
                    features.append(feat)
                    
                    # ターゲット（各番号を予測）
                    for num in current:
                        targets.append(num)
                        
                except Exception as e:
                    continue
            
            # パターン統計更新
            if features:
                features_array = np.array(features)
                self.pattern_stats = {
                    'avg_sum': float(np.mean(features_array[:, 2])),
                    'avg_odd': float(np.mean(features_array[:, 3])),
                    'avg_range': float(np.mean(features_array[:, 7])),
                    'avg_continuous': float(np.mean(features_array[:, 8]))
                }
            
            # 特徴量を番号分複製
            X = []
            for feat in features:
                for _ in range(5):  # ミニロトは5個
                    X.append(feat)
            
            logger.info(f"ミニロト特徴量作成完了: {len(features)}組 → {len(X)}サンプル")
            return np.array(X), np.array(targets)
            
        except Exception as e:
            logger.error(f"特徴量エンジニアリングエラー: {e}")
            return None, None
    
    def predict_next_round(self, count=20, use_learning=True):
        """次回開催回の予測（学習改善オプション付き）"""
        try:
            # 次回情報取得
            next_info = self.data_fetcher.get_next_round_info()
            if not next_info:
                logger.error("次回開催回情報取得失敗")
                return [], {}
            
            logger.info(f"=== {next_info['prediction_target']}の予測開始 ===")
            logger.info(f"予測日時: {next_info['current_date']}")
            logger.info(f"最新データ: 第{next_info['latest_round']}回まで")
            
            # 学習改善の適用確認
            if use_learning and hasattr(self, 'auto_learner') and self.auto_learner.improvement_metrics:
                logger.info("学習改善を適用した予測を実行")
                predictions = self.ensemble_predict_with_learning(count)
            else:
                # 通常のアンサンブル予測
                predictions = self.ensemble_predict(count)
            
            if predictions:
                # 予測を開催回付きで記録
                self.history.add_prediction_with_round(
                    predictions, 
                    next_info['next_round'], 
                    next_info['current_date']
                )
                
                logger.info(f"第{next_info['next_round']}回の予測として記録")
            
            return predictions, next_info
            
        except Exception as e:
            logger.error(f"次回予測エラー: {e}")
            return [], {}
    
    def ensemble_predict(self, count=20):
        """ミニロトアンサンブル予測実行"""
        try:
            if not self.trained_models:
                logger.error("学習済みモデルなし")
                return []
            
            # ミニロト用基準特徴量（16次元）
            if not hasattr(self, 'pattern_stats') or not self.pattern_stats:
                base_features = [
                    16.0,    # 平均 (1+31)/2 = 16
                    8.0,     # 標準偏差
                    80.0,    # 合計 16*5 = 80
                    2.5,     # 奇数数（31の約半分が奇数なので2.5個程度）
                    29.0,    # 最大値
                    3.0,     # 最小値
                    16.0,    # 中央値
                    26.0,    # 範囲
                    1.0,     # 連続数
                    8.0,     # 第1数字
                    16.0,    # 第3数字（中央）
                    24.0,    # 第5数字
                    6.5,     # 平均ギャップ
                    12.0,    # 最大ギャップ
                    2.0,     # 最小ギャップ
                    2.5      # 前半数
                ]
            else:
                base_features = [
                    self.pattern_stats.get('avg_sum', 80) / 5,
                    8.0, self.pattern_stats.get('avg_sum', 80), 2.5, 29.0, 3.0, 16.0, 26.0, 1.0,
                    8.0, 16.0, 24.0, 6.5, 12.0, 2.0, 2.5
                ]
            
            predictions = []
            
            for i in range(count):
                # 各モデルの予測を収集
                ensemble_votes = Counter()
                
                for name, model in self.trained_models.items():
                    try:
                        scaler = self.scalers[name]
                        X_scaled = scaler.transform([base_features])
                        
                        # 複数回予測
                        for _ in range(5):
                            if hasattr(model, 'predict_proba'):
                                proba = model.predict_proba(X_scaled)[0]
                                classes = model.classes_
                                if len(classes) > 0:
                                    selected = np.random.choice(classes, p=proba/proba.sum())
                                    if 1 <= selected <= 31:  # ミニロト範囲
                                        weight = self.model_weights.get(name, 0.33)
                                        ensemble_votes[int(selected)] += weight
                            else:
                                pred = model.predict(X_scaled)[0]
                                if 1 <= pred <= 31:  # ミニロト範囲
                                    weight = self.model_weights.get(name, 0.33)
                                    ensemble_votes[int(pred)] += weight
                                    
                    except Exception as e:
                        logger.error(f"予測エラー ({name}): {e}")
                        continue
                
                # 上位5個を選択（ミニロト）
                if len(ensemble_votes) >= 5:
                    selected_numbers = [num for num, _ in ensemble_votes.most_common(5)]
                    predictions.append(sorted(selected_numbers))
            
            return predictions
            
        except Exception as e:
            logger.error(f"アンサンブル予測エラー: {str(e)}")
            return []
    
    def ensemble_predict_with_learning(self, count=20):
        """学習改善を適用したミニロトアンサンブル予測"""
        try:
            if not self.trained_models:
                logger.error("学習済みモデルなし")
                return []
            
            # 学習調整パラメータを取得
            adjustments = self.auto_learner.get_learning_adjustments()
            boost_numbers = adjustments.get('boost_numbers', [])
            pattern_targets = adjustments.get('pattern_targets', {})
            
            # ミニロト用基準特徴量（学習改善を反映）
            if pattern_targets:
                target_sum = pattern_targets.get('avg_sum', 80)
                base_features = [
                    target_sum / 5,  # 調整された平均
                    8.0, target_sum, pattern_targets.get('avg_odd_count', 2.5),
                    29.0, 3.0, 16.0, 26.0, 1.0,
                    8.0, 16.0, 24.0, 6.5, 12.0, 2.0, 2.5
                ]
            else:
                base_features = [16.0, 8.0, 80.0, 2.5, 29.0, 3.0, 16.0, 26.0, 1.0, 8.0, 16.0, 24.0, 6.5, 12.0, 2.0, 2.5]
            
            predictions = []
            
            for i in range(count):
                # 各モデルの予測を収集
                ensemble_votes = Counter()
                
                for name, model in self.trained_models.items():
                    try:
                        scaler = self.scalers[name]
                        X_scaled = scaler.transform([base_features])
                        
                        # 複数回予測
                        for _ in range(8):
                            if hasattr(model, 'predict_proba'):
                                proba = model.predict_proba(X_scaled)[0]
                                classes = model.classes_
                                if len(classes) > 0:
                                    selected = np.random.choice(classes, p=proba/proba.sum())
                                    if 1 <= selected <= 31:  # ミニロト範囲
                                        weight = self.model_weights.get(name, 0.33)
                                        
                                        # ブースト番号には追加重み
                                        if int(selected) in boost_numbers:
                                            weight *= 1.5
                                            
                                        ensemble_votes[int(selected)] += weight
                            else:
                                pred = model.predict(X_scaled)[0]
                                if 1 <= pred <= 31:  # ミニロト範囲
                                    weight = self.model_weights.get(name, 0.33)
                                    
                                    # ブースト番号には追加重み
                                    if int(pred) in boost_numbers:
                                        weight *= 1.5
                                        
                                    ensemble_votes[int(pred)] += weight
                                    
                    except Exception as e:
                        logger.error(f"予測エラー ({name}): {e}")
                        continue
                
                # 上位5個を選択（ミニロト）
                if len(ensemble_votes) >= 5:
                    selected_numbers = [num for num, _ in ensemble_votes.most_common(5)]
                    predictions.append(sorted(selected_numbers))
            
            return predictions
            
        except Exception as e:
            logger.error(f"学習改善予測エラー: {str(e)}")
            return []
    
    def run_timeseries_validation(self):
        """時系列検証実行（第2段階）"""
        try:
            logger.info("=== ミニロト時系列検証開始 ===")
            
            # データ取得
            if not self.data_fetcher.fetch_latest_data():
                logger.error("データ取得失敗")
                return None
            
            # 時系列検証器初期化
            if not self.validator:
                self.validator = TimeSeriesCrossValidator()
            
            # 検証実行
            results = self.validator.run_validation(
                self.data_fetcher.latest_data,
                self.data_fetcher.main_columns,
                self.data_fetcher.round_column
            )
            
            logger.info("ミニロト時系列検証完了")
            return results
            
        except Exception as e:
            logger.error(f"時系列検証エラー: {e}")
            return None
    
    def run_auto_verification_learning(self):
        """自動照合学習実行（第3段階）"""
        try:
            logger.info("=== ミニロト自動照合・学習改善開始 ===")
            
            # データ取得
            if not self.data_fetcher.fetch_latest_data():
                logger.error("データ取得失敗")
                return None
            
            latest_data = self.data_fetcher.latest_data
            main_cols = self.data_fetcher.main_columns
            
            # 1. 予測履歴との自動照合
            verified_count = self.auto_learner.verify_and_learn(
                self.history,
                latest_data,
                main_cols,
                self.data_fetcher.round_column
            )
            
            if verified_count > 0:
                # 2. 学習改善を反映してモデル再学習
                logger.info("学習改善を反映してミニロトモデル再学習...")
                success = self.train_ensemble_models(latest_data)
                
                if success:
                    logger.info("改善学習完了")
                    
                    # 3. 改善されたモデルを保存
                    if self.file_manager:
                        self.save_models()
            else:
                logger.info("新しい照合可能な予測がありません")
            
            logger.info("ミニロト自動照合・学習改善完了")
            return {
                'verified_count': verified_count,
                'improvements': self.auto_learner.improvement_metrics
            }
            
        except Exception as e:
            logger.error(f"自動照合学習エラー: {e}")
            return None
    
    def get_system_status(self):
        """システム状態を取得"""
        status = {
            'initialized': True,
            'game_type': 'miniloto',
            'models_trained': len(self.trained_models),
            'data_count': self.data_count,
            'latest_round': self.data_fetcher.latest_round,
            'model_scores': self.model_scores,
            'model_weights': self.model_weights,
            'has_data': self.data_fetcher.latest_data is not None,
            'prediction_history': self.history.get_prediction_summary(),
            'learning_status': self.auto_learner.get_learning_summary()
        }
        
        # ファイル状態
        if self.file_manager:
            status['files'] = {
                'model_exists': self.file_manager.model_exists(),
                'history_exists': self.file_manager.history_exists(),
                'data_cached': self.file_manager.data_cached()
            }
        
        return status