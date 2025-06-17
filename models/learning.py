"""
自動照合・学習改善クラス - Flask対応版
継続的学習と改善を行う
"""

import numpy as np
import logging
from collections import Counter
from datetime import datetime

logger = logging.getLogger(__name__)

class AutoVerificationLearner:
    """自動照合と継続的学習改善を行うクラス"""
    
    def __init__(self):
        self.verification_results = []
        self.learning_history = []
        self.improvement_metrics = {}
        self.feature_weights = {}
        
    def verify_and_learn(self, prediction_history, latest_data, main_cols, round_col):
        """予測履歴と実際の結果を照合し、学習を改善"""
        logger.info("=== 自動照合・学習改善開始 ===")
        
        verified_count = 0
        total_improvements = []
        
        for entry in prediction_history.predictions:
            if entry['verified']:
                continue
                
            # 該当する開催回のデータを検索
            matching_data = latest_data[latest_data[round_col] == entry['round']]
            
            if len(matching_data) > 0:
                actual_row = matching_data.iloc[0]
                actual_numbers = []
                for col in main_cols:
                    if col in actual_row.index:
                        actual_numbers.append(int(actual_row[col]))
                
                if len(actual_numbers) == 7:
                    # 照合と分析
                    verification_result = self._analyze_prediction(
                        entry['predictions'], 
                        actual_numbers,
                        entry['round']
                    )
                    
                    self.verification_results.append(verification_result)
                    verified_count += 1
                    
                    # 学習改善
                    improvements = self._improve_from_result(verification_result, actual_row, main_cols)
                    total_improvements.extend(improvements)
        
        if verified_count > 0:
            logger.info(f"{verified_count}件の予測を照合・分析")
            self._aggregate_improvements(total_improvements)
        
        return verified_count
    
    def _analyze_prediction(self, predictions, actual, round_num):
        """予測結果の詳細分析"""
        analysis = {
            'round': round_num,
            'actual': actual,
            'predictions': predictions,
            'match_details': [],
            'patterns': {}
        }
        
        # 各予測セットの分析
        for i, pred in enumerate(predictions):
            pred_set = set([int(x) for x in pred])
            actual_set = set(actual)
            matches = pred_set & actual_set
            
            detail = {
                'prediction_idx': i,
                'matches': len(matches),
                'matched_numbers': sorted(list(matches)),
                'missed_numbers': sorted(list(actual_set - pred_set)),
                'extra_numbers': sorted(list(pred_set - actual_set))
            }
            analysis['match_details'].append(detail)
        
        # パターン分析
        analysis['patterns'] = {
            'actual_sum': sum(actual),
            'actual_odd_count': sum(1 for n in actual if n % 2 == 1),
            'actual_range': max(actual) - min(actual),
            'actual_consecutive': self._count_consecutive(sorted(actual)),
            'best_match_count': max(d['matches'] for d in analysis['match_details'])
        }
        
        return analysis
    
    def _count_consecutive(self, sorted_nums):
        """連続数をカウント"""
        count = 0
        for i in range(len(sorted_nums) - 1):
            if sorted_nums[i+1] - sorted_nums[i] == 1:
                count += 1
        return count
    
    def _improve_from_result(self, verification_result, actual_row, main_cols):
        """照合結果から学習改善点を抽出"""
        improvements = []
        
        # 高精度予測（4個以上一致）の特徴を学習
        high_accuracy_preds = [
            d for d in verification_result['match_details'] 
            if d['matches'] >= 4
        ]
        
        if high_accuracy_preds:
            improvement = {
                'type': 'high_accuracy_pattern',
                'round': verification_result['round'],
                'patterns': verification_result['patterns'],
                'match_count': high_accuracy_preds[0]['matches']
            }
            improvements.append(improvement)
        
        # 頻繁に見逃す数字の学習
        all_missed = []
        for detail in verification_result['match_details']:
            all_missed.extend(detail['missed_numbers'])
        
        if all_missed:
            missed_freq = Counter(all_missed)
            improvement = {
                'type': 'frequently_missed',
                'numbers': missed_freq.most_common(5),
                'round': verification_result['round']
            }
            improvements.append(improvement)
        
        return improvements
    
    def _aggregate_improvements(self, improvements):
        """改善点を集約して学習戦略を更新"""
        logger.info("=== 学習改善点の集約 ===")
        
        # 高精度パターンの集約
        high_acc_patterns = [imp for imp in improvements if imp['type'] == 'high_accuracy_pattern']
        if high_acc_patterns:
            avg_sum = np.mean([p['patterns']['actual_sum'] for p in high_acc_patterns])
            avg_odd = np.mean([p['patterns']['actual_odd_count'] for p in high_acc_patterns])
            logger.info(f"高精度予測パターン: 平均合計 {avg_sum:.1f}, 平均奇数 {avg_odd:.1f}")
            
            self.improvement_metrics['high_accuracy_patterns'] = {
                'avg_sum': avg_sum,
                'avg_odd_count': avg_odd,
                'sample_size': len(high_acc_patterns)
            }
        
        # 頻繁に見逃す数字の集約
        missed_patterns = [imp for imp in improvements if imp['type'] == 'frequently_missed']
        if missed_patterns:
            all_missed_nums = Counter()
            for pattern in missed_patterns:
                for num, count in pattern['numbers']:
                    all_missed_nums[num] += count
            
            logger.info(f"頻繁に見逃す数字TOP5: {all_missed_nums.most_common(5)}")
            self.improvement_metrics['frequently_missed'] = all_missed_nums.most_common(10)
    
    def generate_improvement_report(self):
        """学習改善レポートを生成"""
        if not self.verification_results:
            return {
                'status': 'no_data',
                'message': 'まだ照合結果がありません'
            }
        
        # 全体的な精度計算
        all_matches = []
        for result in self.verification_results:
            for detail in result['match_details']:
                all_matches.append(detail['matches'])
        
        report = {
            'status': 'success',
            'verified_predictions': len(self.verification_results),
            'total_prediction_sets': len(all_matches),
            'performance': {
                'avg_matches': np.mean(all_matches) if all_matches else 0,
                'max_matches': max(all_matches) if all_matches else 0,
                'match_distribution': dict(Counter(all_matches)) if all_matches else {}
            },
            'improvements': {}
        }
        
        # 改善メトリクス
        if self.improvement_metrics:
            if 'high_accuracy_patterns' in self.improvement_metrics:
                patterns = self.improvement_metrics['high_accuracy_patterns']
                report['improvements']['high_accuracy_patterns'] = {
                    'ideal_sum': round(patterns['avg_sum'], 1),
                    'ideal_odd_count': round(patterns['avg_odd_count'], 1),
                    'sample_size': patterns['sample_size']
                }
            
            if 'frequently_missed' in self.improvement_metrics:
                report['improvements']['frequently_missed'] = [
                    {'number': num, 'miss_count': count}
                    for num, count in self.improvement_metrics['frequently_missed'][:5]
                ]
        
        return report
    
    def get_learning_adjustments(self):
        """学習調整パラメータを取得"""
        adjustments = {
            'boost_numbers': [],
            'pattern_targets': {},
            'weight_adjustments': {}
        }
        
        # 頻繁に見逃す数字をブースト
        if 'frequently_missed' in self.improvement_metrics:
            adjustments['boost_numbers'] = [
                num for num, _ in self.improvement_metrics['frequently_missed'][:5]
            ]
        
        # 高精度パターンをターゲット
        if 'high_accuracy_patterns' in self.improvement_metrics:
            adjustments['pattern_targets'] = self.improvement_metrics['high_accuracy_patterns']
        
        return adjustments
    
    def reset_learning_data(self):
        """学習データをリセット"""
        self.verification_results = []
        self.learning_history = []
        self.improvement_metrics = {}
        self.feature_weights = {}
        logger.info("学習データをリセットしました")
    
    def get_learning_summary(self):
        """学習状況のサマリーを取得"""
        return {
            'verification_count': len(self.verification_results),
            'has_improvements': bool(self.improvement_metrics),
            'improvement_types': list(self.improvement_metrics.keys()),
            'learning_history_count': len(self.learning_history)
        }