"""
段階的学習システム
予測精度を維持しながら処理時間を分散
"""

import numpy as np
import pandas as pd
import logging
import json
from datetime import datetime
from collections import Counter
import os

logger = logging.getLogger(__name__)

class ProgressiveLearningManager:
    """段階的学習管理クラス"""
    
    def __init__(self, prediction_system):
        self.prediction_system = prediction_system
        self.learning_state = {
            'stages_completed': [],
            'accumulated_insights': {},
            'feature_weights': {},
            'pattern_adjustments': {},
            'validation_results': {},
            'last_updated': None
        }
        
        # 学習段階の定義
        self.learning_stages = {
            'stage1_fixed_10': {
                'name': '固定窓検証（10回分）',
                'description': '直近10回での予測パターン分析',
                'estimated_time': '3-5分',
                'window_size': 10,
                'type': 'fixed_window'
            },
            'stage2_fixed_20': {
                'name': '固定窓検証（20回分）',
                'description': '中期20回での予測パターン分析',
                'estimated_time': '5-8分',
                'window_size': 20,
                'type': 'fixed_window'
            },
            'stage3_fixed_30': {
                'name': '固定窓検証（30回分）',
                'description': '長期30回での予測パターン分析',
                'estimated_time': '8-12分',
                'window_size': 30,
                'type': 'fixed_window'
            },
            'stage4_expanding': {
                'name': '累積窓検証',
                'description': '全履歴を活用した累積学習',
                'estimated_time': '10-15分',
                'type': 'expanding_window'
            },
            'stage5_ensemble': {
                'name': 'アンサンブル最適化',
                'description': '全段階の結果を統合した最終調整',
                'estimated_time': '2-3分',
                'type': 'ensemble_optimization'
            }
        }
    
    def save_learning_state(self):
        """学習状態を保存"""
        try:
            if self.prediction_system.file_manager:
                state_path = self.prediction_system.file_manager.get_file_path('learning_state.json')
                self.learning_state['last_updated'] = datetime.now().isoformat()
                
                with open(state_path, 'w', encoding='utf-8') as f:
                    json.dump(self.learning_state, f, indent=2, ensure_ascii=False)
                
                logger.info("学習状態を保存しました")
        except Exception as e:
            logger.error(f"学習状態保存エラー: {e}")
    
    def load_learning_state(self):
        """学習状態を読み込み"""
        try:
            if self.prediction_system.file_manager:
                state_path = self.prediction_system.file_manager.get_file_path('learning_state.json')
                
                if os.path.exists(state_path):
                    with open(state_path, 'r', encoding='utf-8') as f:
                        self.learning_state = json.load(f)
                    
                    logger.info(f"学習状態を読み込みました: {len(self.learning_state['stages_completed'])}段階完了")
                    return True
        except Exception as e:
            logger.error(f"学習状態読み込みエラー: {e}")
        
        return False
    
    def get_available_stages(self):
        """実行可能な学習段階を取得"""
        completed = set(self.learning_state['stages_completed'])
        available = []
        
        for stage_id, stage_info in self.learning_stages.items():
            status = 'completed' if stage_id in completed else 'available'
            
            # 前提条件チェック
            if stage_id == 'stage2_fixed_20' and 'stage1_fixed_10' not in completed:
                status = 'locked'
            elif stage_id == 'stage3_fixed_30' and 'stage2_fixed_20' not in completed:
                status = 'locked'
            elif stage_id == 'stage4_expanding' and 'stage1_fixed_10' not in completed:
                status = 'locked'
            elif stage_id == 'stage5_ensemble' and len(completed) < 3:
                status = 'locked'
            
            available.append({
                'id': stage_id,
                'name': stage_info['name'],
                'description': stage_info['description'],
                'estimated_time': stage_info['estimated_time'],
                'status': status
            })
        
        return available
    
    def execute_learning_stage(self, stage_id):
        """指定された学習段階を実行"""
        if stage_id not in self.learning_stages:
            raise ValueError(f"無効な学習段階: {stage_id}")
        
        stage_info = self.learning_stages[stage_id]
        logger.info(f"=== {stage_info['name']} 開始 ===")
        
        try:
            # データ取得
            if not self.prediction_system.data_fetcher.fetch_latest_data():
                raise Exception("データ取得に失敗しました")
            
            data = self.prediction_system.data_fetcher.latest_data
            main_cols = self.prediction_system.data_fetcher.main_columns
            round_col = self.prediction_system.data_fetcher.round_column
            
            # 段階に応じた処理実行
            if stage_info['type'] == 'fixed_window':
                result = self._execute_fixed_window_stage(
                    data, main_cols, round_col, 
                    stage_info['window_size'], stage_id
                )
            elif stage_info['type'] == 'expanding_window':
                result = self._execute_expanding_window_stage(
                    data, main_cols, round_col, stage_id
                )
            elif stage_info['type'] == 'ensemble_optimization':
                result = self._execute_ensemble_optimization_stage(stage_id)
            
            # 結果を学習状態に蓄積
            self._accumulate_learning_insights(stage_id, result)
            
            # 完了段階に追加
            if stage_id not in self.learning_state['stages_completed']:
                self.learning_state['stages_completed'].append(stage_id)
            
            # 学習状態保存
            self.save_learning_state()
            
            logger.info(f"✅ {stage_info['name']} 完了")
            return result
            
        except Exception as e:
            logger.error(f"❌ {stage_info['name']} エラー: {e}")
            raise e
    
    def _execute_fixed_window_stage(self, data, main_cols, round_col, window_size, stage_id):
        """固定窓段階の実行"""
        logger.info(f"固定窓検証開始: {window_size}回分")
        
        # 前段階の洞察を活用
        feature_adjustments = self._get_accumulated_feature_adjustments()
        
        # 固定窓検証の実行（フル機能）
        validator = self.prediction_system.validator
        if not validator:
            from models.validation import TimeSeriesCrossValidator
            validator = TimeSeriesCrossValidator()
            self.prediction_system.validator = validator
        
        # 単一窓サイズでの検証
        results = validator.fixed_window_validation(
            data, main_cols, round_col, [window_size]
        )
        
        # 結果分析
        window_results = results.get(window_size, [])
        if window_results:
            analysis = self._analyze_window_results(window_results, window_size)
            
            # 特徴量重み調整
            feature_weights = self._extract_feature_weights(window_results)
            
            # パターン分析
            pattern_insights = self._extract_pattern_insights(window_results)
            
            return {
                'stage_id': stage_id,
                'window_size': window_size,
                'total_tests': len(window_results),
                'analysis': analysis,
                'feature_weights': feature_weights,
                'pattern_insights': pattern_insights,
                'raw_results': window_results[:5]  # 最初の5件のみ保存
            }
        
        return {'stage_id': stage_id, 'error': '検証結果なし'}
    
    def _execute_expanding_window_stage(self, data, main_cols, round_col, stage_id):
        """累積窓段階の実行"""
        logger.info("累積窓検証開始")
        
        validator = self.prediction_system.validator
        if not validator:
            from models.validation import TimeSeriesCrossValidator
            validator = TimeSeriesCrossValidator()
            self.prediction_system.validator = validator
        
        # 累積窓検証の実行
        results = validator.expanding_window_validation(
            data, main_cols, round_col, initial_size=30
        )
        
        if results:
            analysis = self._analyze_expanding_results(results)
            feature_weights = self._extract_feature_weights(results)
            pattern_insights = self._extract_pattern_insights(results)
            
            return {
                'stage_id': stage_id,
                'total_tests': len(results),
                'analysis': analysis,
                'feature_weights': feature_weights,
                'pattern_insights': pattern_insights,
                'raw_results': results[:5]
            }
        
        return {'stage_id': stage_id, 'error': '検証結果なし'}
    
    def _execute_ensemble_optimization_stage(self, stage_id):
        """アンサンブル最適化段階の実行"""
        logger.info("アンサンブル最適化開始")
        
        # 全段階の結果を統合
        accumulated = self.learning_state['accumulated_insights']
        
        # モデル重みの最適化
        optimized_weights = self._optimize_model_weights()
        
        # 特徴量重要度の統合
        unified_feature_weights = self._unify_feature_weights()
        
        # パターン調整の最終化
        final_pattern_adjustments = self._finalize_pattern_adjustments()
        
        # 予測システムに適用
        self._apply_optimizations_to_system(
            optimized_weights, 
            unified_feature_weights, 
            final_pattern_adjustments
        )
        
        return {
            'stage_id': stage_id,
            'optimized_weights': optimized_weights,
            'unified_feature_weights': unified_feature_weights,
            'final_adjustments': final_pattern_adjustments,
            'stages_integrated': len(accumulated)
        }
    
    def _accumulate_learning_insights(self, stage_id, result):
        """学習洞察を蓄積"""
        insights = self.learning_state['accumulated_insights']
        insights[stage_id] = {
            'timestamp': datetime.now().isoformat(),
            'analysis': result.get('analysis', {}),
            'feature_weights': result.get('feature_weights', {}),
            'pattern_insights': result.get('pattern_insights', {})
        }
        
        # 累積特徴量重みの更新
        if 'feature_weights' in result:
            self._update_accumulated_feature_weights(result['feature_weights'])
        
        # パターン調整の更新
        if 'pattern_insights' in result:
            self._update_pattern_adjustments(result['pattern_insights'])
    
    def _analyze_window_results(self, results, window_size):
        """窓検証結果の分析"""
        if not results:
            return {}
        
        all_matches = [r['avg_matches'] for r in results]
        max_matches_list = [r['max_matches'] for r in results]
        
        return {
            'avg_matches': np.mean(all_matches),
            'std_matches': np.std(all_matches),
            'max_matches': max(max_matches_list),
            'consistency': 1.0 / (1.0 + np.std(all_matches)),  # 一貫性指標
            'total_validations': len(results),
            'window_size': window_size
        }
    
    def _analyze_expanding_results(self, results):
        """累積窓結果の分析"""
        if not results:
            return {}
        
        all_matches = [r['avg_matches'] for r in results]
        
        # 時系列的な改善傾向分析
        improvement_trend = []
        for i in range(1, len(all_matches)):
            improvement_trend.append(all_matches[i] - all_matches[i-1])
        
        return {
            'avg_matches': np.mean(all_matches),
            'improvement_trend': np.mean(improvement_trend) if improvement_trend else 0,
            'stability_score': 1.0 - (np.std(all_matches) / (np.mean(all_matches) + 1e-6)),
            'total_validations': len(results)
        }
    
    def _extract_feature_weights(self, results):
        """結果から特徴量重みを抽出"""
        # 高精度予測の特徴パターンを分析
        high_accuracy_results = [r for r in results if r.get('max_matches', 0) >= 4]
        
        if not high_accuracy_results:
            return {}
        
        # 共通パターンの特徴を重みとして抽出
        weights = {
            'sum_importance': len([r for r in high_accuracy_results if abs(r.get('actual_sum', 133) - 133) < 20]) / len(high_accuracy_results),
            'odd_importance': len([r for r in high_accuracy_results if 3 <= r.get('actual_odd_count', 3) <= 4]) / len(high_accuracy_results),
            'range_importance': len([r for r in high_accuracy_results if 25 <= r.get('actual_range', 30) <= 35]) / len(high_accuracy_results)
        }
        
        return weights
    
    def _extract_pattern_insights(self, results):
        """パターン洞察を抽出"""
        insights = {}
        
        # 高精度予測のパターン分析
        high_accuracy = [r for r in results if r.get('max_matches', 0) >= 4]
        
        if high_accuracy:
            insights['optimal_sum_range'] = (
                np.mean([r.get('actual_sum', 133) for r in high_accuracy]) - 10,
                np.mean([r.get('actual_sum', 133) for r in high_accuracy]) + 10
            )
            
            insights['optimal_odd_count'] = round(
                np.mean([r.get('actual_odd_count', 3) for r in high_accuracy])
            )
            
            insights['success_patterns'] = len(high_accuracy)
        
        return insights
    
    def _get_accumulated_feature_adjustments(self):
        """累積特徴量調整を取得"""
        return self.learning_state.get('feature_weights', {})
    
    def _update_accumulated_feature_weights(self, new_weights):
        """累積特徴量重みを更新"""
        current = self.learning_state.get('feature_weights', {})
        
        for key, weight in new_weights.items():
            if key in current:
                # 移動平均で更新
                current[key] = 0.7 * current[key] + 0.3 * weight
            else:
                current[key] = weight
        
        self.learning_state['feature_weights'] = current
    
    def _update_pattern_adjustments(self, insights):
        """パターン調整を更新"""
        current = self.learning_state.get('pattern_adjustments', {})
        
        for key, value in insights.items():
            current[key] = value
        
        self.learning_state['pattern_adjustments'] = current
    
    def _optimize_model_weights(self):
        """モデル重みの最適化"""
        # 各段階の結果を基にモデル重みを調整
        insights = self.learning_state['accumulated_insights']
        
        # デフォルト重み
        weights = {
            'random_forest': 0.4,
            'gradient_boost': 0.35,
            'neural_network': 0.25
        }
        
        # 段階結果を基に調整
        total_accuracy = 0
        count = 0
        
        for stage_result in insights.values():
            analysis = stage_result.get('analysis', {})
            if 'avg_matches' in analysis:
                total_accuracy += analysis['avg_matches']
                count += 1
        
        if count > 0:
            avg_accuracy = total_accuracy / count
            
            # 精度が高い場合はニューラルネットワークの重みを増加
            if avg_accuracy > 3.0:
                weights['neural_network'] = 0.35
                weights['random_forest'] = 0.35
                weights['gradient_boost'] = 0.3
        
        return weights
    
    def _unify_feature_weights(self):
        """特徴量重みの統合"""
        return self.learning_state.get('feature_weights', {})
    
    def _finalize_pattern_adjustments(self):
        """パターン調整の最終化"""
        return self.learning_state.get('pattern_adjustments', {})
    
    def _apply_optimizations_to_system(self, weights, feature_weights, adjustments):
        """最適化を予測システムに適用"""
        # モデル重みの適用
        if hasattr(self.prediction_system, 'model_weights'):
            self.prediction_system.model_weights.update(weights)
        
        # パターン統計の更新
        if hasattr(self.prediction_system, 'pattern_stats'):
            pattern_stats = self.prediction_system.pattern_stats or {}
            
            # 最適化された値で更新
            if 'optimal_sum_range' in adjustments:
                sum_range = adjustments['optimal_sum_range']
                pattern_stats['avg_sum'] = (sum_range[0] + sum_range[1]) / 2
            
            if 'optimal_odd_count' in adjustments:
                pattern_stats['avg_odd'] = adjustments['optimal_odd_count']
            
            self.prediction_system.pattern_stats = pattern_stats
        
        logger.info("最適化を予測システムに適用しました")
    
    def get_learning_progress(self):
        """学習進捗を取得"""
        total_stages = len(self.learning_stages)
        completed_stages = len(self.learning_state['stages_completed'])
        
        return {
            'total_stages': total_stages,
            'completed_stages': completed_stages,
            'progress_percentage': (completed_stages / total_stages) * 100,
            'available_stages': self.get_available_stages(),
            'last_updated': self.learning_state.get('last_updated'),
            'accumulated_insights': len(self.learning_state.get('accumulated_insights', {}))
        }
    
    def reset_learning_progress(self):
        """学習進捗をリセット"""
        self.learning_state = {
            'stages_completed': [],
            'accumulated_insights': {},
            'feature_weights': {},
            'pattern_adjustments': {},
            'validation_results': {},
            'last_updated': None
        }
        self.save_learning_state()
        logger.info("学習進捗をリセットしました")