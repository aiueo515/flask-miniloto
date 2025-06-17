"""
時系列交差検証クラス - Flask対応版
本格的な時系列交差検証を実行
"""

import numpy as np
import pandas as pd
import logging
from collections import Counter
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score

logger = logging.getLogger(__name__)

class TimeSeriesCrossValidator:
    """本格的な時系列交差検証クラス（モデル学習・20セット予測対応）"""
    
    def __init__(self, min_train_size=10):
        self.min_train_size = min_train_size
        self.fixed_window_results = {}  # 窓サイズ別の結果
        self.expanding_window_results = []
        self.validation_history = []
        self.feature_importance_history = {}
        
        # 本番と同じフルモデル
        self.validation_models = {
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
        
        self.model_weights = {
            'random_forest': 0.4,
            'gradient_boost': 0.35,
            'neural_network': 0.25
        }
        
    def evaluate_prediction_sets(self, predicted_sets, actual):
        """20セット予測と実際の一致を評価"""
        results = []
        
        actual_set = set(actual)
        
        for i, predicted in enumerate(predicted_sets):
            predicted_set = set([int(x) for x in predicted])
            matches = len(predicted_set & actual_set)
            
            result = {
                'set_idx': i,
                'matches': matches,
                'accuracy': matches / 7.0,
                'predicted': [int(x) for x in predicted],
                'actual': actual,
                'matched_numbers': sorted(list(predicted_set & actual_set)),
                'missed_numbers': sorted(list(actual_set - predicted_set)),
                'extra_numbers': sorted(list(predicted_set - actual_set))
            }
            results.append(result)
        
        # 全体統計
        all_matches = [r['matches'] for r in results]
        summary = {
            'avg_matches': np.mean(all_matches),
            'max_matches': max(all_matches),
            'min_matches': min(all_matches),
            'std_matches': np.std(all_matches),
            'sets_3_plus': sum(1 for m in all_matches if m >= 3),
            'sets_4_plus': sum(1 for m in all_matches if m >= 4),
            'sets_5_plus': sum(1 for m in all_matches if m >= 5),
            'match_distribution': dict(Counter(all_matches)),
            'individual_results': results
        }
        
        return summary
    
    def create_validation_features(self, data, main_cols):
        """本番と同じ16次元フル特徴量を作成"""
        try:
            features = []
            targets = []
            freq_counter = Counter()
            pair_freq = Counter()
            
            for i in range(len(data)):
                try:
                    current = []
                    for col in main_cols:
                        if col in data.columns:
                            current.append(int(data.iloc[i][col]))
                    
                    if len(current) != 7:
                        continue
                    
                    if not all(1 <= x <= 37 for x in current):
                        continue
                    if len(set(current)) != 7:
                        continue
                    
                    # 基本統計
                    for num in current:
                        freq_counter[num] += 1
                    
                    # ペア分析
                    for j in range(len(current)):
                        for k in range(j+1, len(current)):
                            pair = tuple(sorted([current[j], current[k]]))
                            pair_freq[pair] += 1
                    
                    # 本番と同じ16次元特徴量
                    sorted_nums = sorted(current)
                    gaps = [sorted_nums[j+1] - sorted_nums[j] for j in range(6)]
                    
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
                        float(current[3]),                 # 第4数字
                        float(current[6]),                 # 第7数字
                        float(np.mean(gaps)),              # 平均ギャップ
                        float(max(gaps)),                  # 最大ギャップ
                        float(min(gaps)),                  # 最小ギャップ
                        float(len([x for x in current if x <= 12])), # 小数字数
                    ]
                    
                    # 次回予測ターゲット
                    if i < len(data) - 1:
                        next_nums = []
                        for col in main_cols:
                            if col in data.columns:
                                next_nums.append(int(data.iloc[i+1][col]))
                        
                        if len(next_nums) == 7:
                            for target_num in next_nums:
                                features.append(feat.copy())
                                targets.append(target_num)
                        
                except Exception as e:
                    continue
            
            logger.info(f"フル特徴量完成: {len(features)}個（16次元）")
            return np.array(features), np.array(targets), freq_counter
            
        except Exception as e:
            logger.error(f"特徴量エンジニアリングエラー: {e}")
            return None, None, Counter()
    
    def train_validation_models(self, train_data, main_cols):
        """本番と同じフルモデルを学習"""
        try:
            # 本番と同じ16次元特徴量作成
            X, y, freq_counter = self.create_validation_features(train_data, main_cols)
            if X is None or len(X) < 50:  # 最低限必要なデータ数
                return None
            
            trained_models = {}
            scalers = {}
            
            for name, model in self.validation_models.items():
                try:
                    # スケーリング
                    scaler = StandardScaler()
                    X_scaled = scaler.fit_transform(X)
                    
                    # 本番と同じ学習
                    model_copy = type(model)(**model.get_params())
                    model_copy.fit(X_scaled, y)
                    
                    trained_models[name] = model_copy
                    scalers[name] = scaler
                    
                except Exception as e:
                    logger.warning(f"モデル {name} の学習でエラー: {e}")
                    continue
            
            return {
                'models': trained_models, 
                'scalers': scalers,
                'freq_counter': freq_counter
            }
            
        except Exception as e:
            logger.error(f"検証モデル学習エラー: {e}")
            return None
    
    def generate_validation_predictions(self, model_data, freq_counter, count=20):
        """本番と同じアンサンブル手法で20セット予測を生成"""
        try:
            if not model_data or not model_data['models']:
                return []
            
            trained_models = model_data['models']
            scalers = model_data['scalers']
            
            # 本番と同じ基準特徴量（16次元）
            base_features = [19.0, 10.0, 133.0, 3.5, 35.0, 5.0, 19.0, 30.0, 1.0, 10.0, 20.0, 30.0, 4.5, 8.0, 2.0, 3.0]
            
            predictions = []
            
            for i in range(count):
                # 各モデルの予測を収集（本番と同じアルゴリズム）
                ensemble_votes = Counter()
                
                for name, model in trained_models.items():
                    try:
                        scaler = scalers[name]
                        X_scaled = scaler.transform([base_features])
                        
                        # 複数回予測（本番と同じ回数）
                        for _ in range(8):
                            if hasattr(model, 'predict_proba'):
                                proba = model.predict_proba(X_scaled)[0]
                                classes = model.classes_
                                if len(classes) > 0:
                                    selected = np.random.choice(classes, p=proba/proba.sum())
                                    if 1 <= selected <= 37:
                                        weight = self.model_weights.get(name, 0.33)
                                        ensemble_votes[int(selected)] += weight
                            else:
                                pred = model.predict(X_scaled)[0]
                                if 1 <= pred <= 37:
                                    weight = self.model_weights.get(name, 0.33)
                                    ensemble_votes[int(pred)] += weight
                                    
                    except Exception as e:
                        continue
                
                # 頻出数字と組み合わせ（本番と同じ）
                frequent_nums = [num for num, _ in freq_counter.most_common(15)]
                for num in frequent_nums[:8]:
                    ensemble_votes[num] += 0.1
                
                # 上位7個を選択
                top_numbers = [num for num, _ in ensemble_votes.most_common(7)]
                
                # 不足分をランダム補完
                while len(top_numbers) < 7:
                    candidate = np.random.randint(1, 38)
                    if candidate not in top_numbers:
                        top_numbers.append(candidate)
                
                final_pred = sorted([int(x) for x in top_numbers[:7]])
                predictions.append(final_pred)
            
            return predictions
            
        except Exception as e:
            logger.error(f"検証用予測生成エラー: {e}")
            return []
    
    def fixed_window_validation(self, data, main_cols, round_col, window_sizes=[10, 20, 30]):
        """複数窓サイズによる固定窓検証（効率化版）"""
        logger.info(f"=== 固定窓検証開始（窓サイズ: {window_sizes}回） ===")
        
        total_rounds = len(data)
        results_by_window = {}
        
        for window_size in window_sizes:
            logger.info(f"🔄 {window_size}回分窓での検証開始")
            results = []
            
            # 効率化：全回ではなく一定間隔でサンプリング
            max_tests = min(total_rounds - window_size - 1, 50)  # 最大50回のテストに制限
            step = max(1, (total_rounds - window_size - 1) // max_tests)
            
            logger.info(f"検証範囲: {max_tests}回（step={step}）")
            
            for i in range(0, total_rounds - window_size - 1, step):
                if len(results) >= max_tests:
                    break
                    
                # 訓練データ: i〜i+window_size-1
                train_start = i
                train_end = i + window_size
                test_idx = train_end
                
                if test_idx >= total_rounds:
                    break
                
                # 訓練データ取得
                train_data = data.iloc[train_start:train_end]
                test_round = data.iloc[test_idx][round_col]
                actual_numbers = []
                for col in main_cols:
                    if col in data.columns:
                        actual_numbers.append(int(data.iloc[test_idx][col]))
                
                if len(actual_numbers) == 7:
                    # フルモデル学習
                    model_data = self.train_validation_models(train_data, main_cols)
                    
                    if model_data and model_data['models']:
                        # 本番と同じ20セット予測生成
                        predicted_sets = self.generate_validation_predictions(
                            model_data, 
                            model_data['freq_counter'], 
                            20
                        )
                        
                        if predicted_sets:
                            # 詳細評価
                            eval_result = self.evaluate_prediction_sets(predicted_sets, actual_numbers)
                            eval_result['train_range'] = f"第{train_start + 1}回〜第{train_end}回"
                            eval_result['test_round'] = test_round
                            eval_result['window_size'] = window_size
                            
                            results.append(eval_result)
                
                # 進捗表示
                if (len(results) + 1) % 10 == 0:
                    if results:
                        avg_matches = np.mean([r['avg_matches'] for r in results])
                        logger.info(f"  進捗: {len(results)}/{max_tests}件 | 平均一致: {avg_matches:.2f}")
            
            results_by_window[window_size] = results
            
            # 窓サイズ別サマリー
            if results:
                avg_matches = np.mean([r['avg_matches'] for r in results])
                max_matches = max([r['max_matches'] for r in results])
                sets_4_plus = np.mean([r['sets_4_plus'] for r in results])
                logger.info(f"📊 {window_size}回分窓 結果:")
                logger.info(f"    検証回数: {len(results)}回 | 平均一致: {avg_matches:.3f}個 | 最高一致: {max_matches}個")
        
        self.fixed_window_results = results_by_window
        return results_by_window
    
    def expanding_window_validation(self, data, main_cols, round_col, initial_size=30):
        """累積窓による時系列交差検証（効率化版）"""
        logger.info(f"=== 累積窓検証開始（初期サイズ: {initial_size}回） ===")
        
        results = []
        total_rounds = len(data)
        
        # 効率化：全回ではなく一定間隔でサンプリング
        max_tests = min(total_rounds - initial_size, 30)  # 最大30回のテストに制限
        step = max(1, (total_rounds - initial_size) // max_tests)
        
        logger.info(f"検証範囲: {max_tests}回（step={step}）")
        
        for i in range(0, total_rounds - initial_size, step):
            if len(results) >= max_tests:
                break
                
            test_idx = initial_size + i
            
            if test_idx >= total_rounds:
                break
            
            # 訓練データ: 0〜test_idx-1（累積）
            train_data = data.iloc[0:test_idx]
            test_round = data.iloc[test_idx][round_col]
            actual_numbers = []
            for col in main_cols:
                if col in data.columns:
                    actual_numbers.append(int(data.iloc[test_idx][col]))
            
            if len(actual_numbers) == 7:
                # フルモデル学習
                model_data = self.train_validation_models(train_data, main_cols)
                
                if model_data and model_data['models']:
                    # 本番と同じ20セット予測生成
                    predicted_sets = self.generate_validation_predictions(
                        model_data, 
                        model_data['freq_counter'], 
                        20
                    )
                    
                    if predicted_sets:
                        # 詳細評価
                        eval_result = self.evaluate_prediction_sets(predicted_sets, actual_numbers)
                        eval_result['train_range'] = f"第1回〜第{test_idx}回"
                        eval_result['test_round'] = test_round
                        eval_result['train_size'] = len(train_data)
                        
                        results.append(eval_result)
            
            # 進捗表示
            if (len(results) + 1) % 10 == 0:
                if results:
                    avg_matches = np.mean([r['avg_matches'] for r in results])
                    logger.info(f"  進捗: {len(results)}/{max_tests}件 | 平均一致: {avg_matches:.2f}")
        
        self.expanding_window_results = results
        
        # 累積窓サマリー
        if results:
            avg_matches = np.mean([r['avg_matches'] for r in results])
            max_matches = max([r['max_matches'] for r in results])
            sets_4_plus = np.mean([r['sets_4_plus'] for r in results])
            logger.info(f"📊 累積窓 結果:")
            logger.info(f"    検証回数: {len(results)}回 | 平均一致: {avg_matches:.3f}個 | 最高一致: {max_matches}個")
        
        return results
    
    def compare_validation_methods(self):
        """固定窓（複数サイズ）と累積窓の結果を比較"""
        logger.info("=== 検証手法の詳細比較分析 ===")
        
        if not self.fixed_window_results or not self.expanding_window_results:
            logger.error("検証結果が不足しています")
            return None
        
        comparison_results = {}
        
        # 固定窓（各サイズ）の統計
        for window_size, results in self.fixed_window_results.items():
            if results:
                avg_matches_list = [r['avg_matches'] for r in results]
                max_matches_list = [r['max_matches'] for r in results]
                sets_4_plus_list = [r['sets_4_plus'] for r in results]
                sets_5_plus_list = [r['sets_5_plus'] for r in results]
                
                stats = {
                    'method': f'固定窓（{window_size}回）',
                    'window_size': window_size,
                    'avg_matches': np.mean(avg_matches_list),
                    'std_matches': np.std(avg_matches_list),
                    'max_matches': max(max_matches_list),
                    'avg_sets_4_plus': np.mean(sets_4_plus_list),
                    'avg_sets_5_plus': np.mean(sets_5_plus_list),
                    'total_tests': len(results)
                }
                comparison_results[f'fixed_{window_size}'] = stats
        
        # 累積窓の統計
        if self.expanding_window_results:
            avg_matches_list = [r['avg_matches'] for r in self.expanding_window_results]
            max_matches_list = [r['max_matches'] for r in self.expanding_window_results]
            sets_4_plus_list = [r['sets_4_plus'] for r in self.expanding_window_results]
            sets_5_plus_list = [r['sets_5_plus'] for r in self.expanding_window_results]
            
            expanding_stats = {
                'method': '累積窓',
                'avg_matches': np.mean(avg_matches_list),
                'std_matches': np.std(avg_matches_list),
                'max_matches': max(max_matches_list),
                'avg_sets_4_plus': np.mean(sets_4_plus_list),
                'avg_sets_5_plus': np.mean(sets_5_plus_list),
                'total_tests': len(self.expanding_window_results)
            }
            comparison_results['expanding'] = expanding_stats
        
        # 最適手法の決定
        best_method = None
        best_score = 0
        
        for method_key, stats in comparison_results.items():
            # 総合スコア（平均一致数 + 4個以上一致セット数 + 5個以上一致セット数の重み付け）
            score = stats['avg_matches'] + stats['avg_sets_4_plus'] * 0.5 + stats['avg_sets_5_plus'] * 1.0
            
            if score > best_score:
                best_score = score
                best_method = stats['method']
        
        # 推奨事項の決定
        recommendation = 'expanding'
        if 'fixed_30' in comparison_results and comparison_results['fixed_30']['avg_matches'] > comparison_results.get('expanding', {}).get('avg_matches', 0):
            recommendation = 'fixed_30'
        elif 'fixed_20' in comparison_results and comparison_results['fixed_20']['avg_matches'] > comparison_results.get('expanding', {}).get('avg_matches', 0):
            recommendation = 'fixed_20'
        elif 'fixed_10' in comparison_results:
            recommendation = 'fixed_10'
        
        return {
            'detailed_results': comparison_results,
            'best_method': best_method,
            'best_score': best_score,
            'recommendation': recommendation,
            'improvement': best_score - min([stats['avg_matches'] for stats in comparison_results.values()]) if comparison_results else 0
        }
    
    def get_validation_summary(self):
        """検証結果のサマリーを取得"""
        summary = {
            'fixed_window_tested': len(self.fixed_window_results),
            'expanding_window_tested': len(self.expanding_window_results) > 0,
            'total_validations': sum(len(results) for results in self.fixed_window_results.values()) + len(self.expanding_window_results)
        }
        
        if self.fixed_window_results:
            all_fixed_results = []
            for results in self.fixed_window_results.values():
                all_fixed_results.extend(results)
            
            if all_fixed_results:
                summary['fixed_window_performance'] = {
                    'avg_matches': np.mean([r['avg_matches'] for r in all_fixed_results]),
                    'max_matches': max([r['max_matches'] for r in all_fixed_results]),
                    'avg_sets_4_plus': np.mean([r['sets_4_plus'] for r in all_fixed_results])
                }
        
        if self.expanding_window_results:
            summary['expanding_window_performance'] = {
                'avg_matches': np.mean([r['avg_matches'] for r in self.expanding_window_results]),
                'max_matches': max([r['max_matches'] for r in self.expanding_window_results]),
                'avg_sets_4_plus': np.mean([r['sets_4_plus'] for r in self.expanding_window_results])
            }
        
        return summary