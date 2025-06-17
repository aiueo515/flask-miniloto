"""
予測履歴管理クラス - Flask対応版
開催回対応の予測記録・照合機能
"""

import pandas as pd
import numpy as np
import logging
from datetime import datetime
from collections import Counter

logger = logging.getLogger(__name__)

class RoundAwarePredictionHistory:
    """開催回対応予測履歴管理クラス"""
    
    def __init__(self):
        self.predictions = []  # [{'round': int, 'date': str, 'predictions': list, 'actual': list or None}]
        self.accuracy_stats = {}
        
        # ファイル管理は外部から設定
        self.file_manager = None
        
    def set_file_manager(self, file_manager):
        """ファイル管理器を設定"""
        self.file_manager = file_manager
        
    def add_prediction_with_round(self, predictions, target_round, date=None):
        """開催回付きで予測を記録"""
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 既存の予測があるかチェック
        existing = self.find_prediction_by_round(target_round)
        if existing:
            logger.warning(f"第{target_round}回の予測は既に存在します")
            return False
        
        entry = {
            'round': target_round,
            'date': date,
            'predictions': predictions.copy(),
            'actual': None,
            'matches': [],
            'verified': False
        }
        self.predictions.append(entry)
        logger.info(f"予測記録: 第{target_round}回 - {date} - {len(predictions)}セット")
        
        # ファイルに保存
        if self.file_manager:
            self.save_to_csv()
        
        return True
        
    def find_prediction_by_round(self, round_number):
        """指定開催回の予測を検索"""
        for entry in self.predictions:
            if entry['round'] == round_number:
                return entry
        return None
    
    def auto_verify_with_data(self, latest_data, round_col, main_cols):
        """最新データと自動照合"""
        verified_count = 0
        
        for entry in self.predictions:
            if entry['verified']:
                continue
                
            # 該当する開催回のデータを検索
            matching_data = latest_data[latest_data[round_col] == entry['round']]
            
            if len(matching_data) > 0:
                actual_row = matching_data.iloc[0]
                actual_numbers = []
                for col in main_cols:
                    if col in actual_row.index and pd.notna(actual_row[col]):
                        actual_numbers.append(int(actual_row[col]))
                
                if len(actual_numbers) == 7:
                    entry['actual'] = actual_numbers
                    
                    # 各予測セットとの一致数を計算
                    matches = []
                    for pred_set in entry['predictions']:
                        match_count = len(set(pred_set) & set(actual_numbers))
                        matches.append(match_count)
                    
                    entry['matches'] = matches
                    entry['verified'] = True
                    verified_count += 1
                    
                    logger.info(f"自動照合完了: 第{entry['round']}回")
                    logger.info(f"   当選番号: {actual_numbers}")
                    logger.info(f"   一致数: {matches}")
                    logger.info(f"   最高一致: {max(matches)}個")
        
        if verified_count > 0:
            self._update_accuracy_stats()
            logger.info(f"{verified_count}件の予測を自動照合しました")
            
            # ファイルに保存
            if self.file_manager:
                self.save_to_csv()
        
        return verified_count
    
    def _update_accuracy_stats(self):
        """精度統計を更新"""
        all_matches = []
        verified_predictions = [entry for entry in self.predictions if entry['verified']]
        
        for entry in verified_predictions:
            all_matches.extend(entry['matches'])
        
        if all_matches:
            self.accuracy_stats = {
                'total_predictions': len(all_matches),
                'verified_rounds': len(verified_predictions),
                'avg_matches': np.mean(all_matches),
                'max_matches': max(all_matches),
                'match_distribution': dict(Counter(all_matches)),
                'accuracy_by_match': {
                    '0_matches': all_matches.count(0),
                    '1_matches': all_matches.count(1),
                    '2_matches': all_matches.count(2),
                    '3_matches': all_matches.count(3),
                    '4_matches': all_matches.count(4),
                    '5_matches': all_matches.count(5),
                    '6_matches': all_matches.count(6),
                    '7_matches': all_matches.count(7)
                }
            }
    
    def get_accuracy_report(self):
        """精度レポートを生成"""
        if not self.accuracy_stats:
            return {
                'status': 'no_data',
                'message': 'まだ照合済みの予測がありません'
            }
        
        stats = self.accuracy_stats
        
        # 分布データを整理
        match_distribution = []
        for i in range(8):
            count = stats['accuracy_by_match'].get(f'{i}_matches', 0)
            percentage = (count / stats['total_predictions']) * 100 if stats['total_predictions'] > 0 else 0
            match_distribution.append({
                'matches': i,
                'count': count,
                'percentage': round(percentage, 1)
            })
        
        report = {
            'status': 'success',
            'verified_rounds': stats['verified_rounds'],
            'total_predictions': stats['total_predictions'],
            'avg_matches': round(stats['avg_matches'], 2),
            'max_matches': stats['max_matches'],
            'match_distribution': match_distribution,
            'summary': {
                'excellent_predictions': stats['accuracy_by_match'].get('7_matches', 0) + stats['accuracy_by_match'].get('6_matches', 0),
                'good_predictions': stats['accuracy_by_match'].get('5_matches', 0) + stats['accuracy_by_match'].get('4_matches', 0),
                'fair_predictions': stats['accuracy_by_match'].get('3_matches', 0),
                'poor_predictions': sum([stats['accuracy_by_match'].get(f'{i}_matches', 0) for i in range(3)])
            }
        }
        
        return report
    
    def save_to_csv(self):
        """予測履歴をCSVに保存"""
        if not self.file_manager:
            logger.warning("ファイル管理器が設定されていません")
            return False
            
        return self.file_manager.save_history(self)
    
    def load_from_csv(self):
        """CSVから予測履歴を読み込み"""
        if not self.file_manager:
            logger.warning("ファイル管理器が設定されていません")
            return False
            
        return self.file_manager.load_history(self)
    
    def get_prediction_summary(self):
        """予測履歴のサマリーを取得"""
        if not self.predictions:
            return {
                'total_rounds': 0,
                'verified_rounds': 0,
                'pending_rounds': 0,
                'latest_round': None,
                'earliest_round': None
            }
        
        verified_count = sum(1 for entry in self.predictions if entry['verified'])
        rounds = [entry['round'] for entry in self.predictions]
        
        return {
            'total_rounds': len(self.predictions),
            'verified_rounds': verified_count,
            'pending_rounds': len(self.predictions) - verified_count,
            'latest_round': max(rounds) if rounds else None,
            'earliest_round': min(rounds) if rounds else None,
            'prediction_counts': [len(entry['predictions']) for entry in self.predictions]
        }
    
    def get_recent_predictions(self, count=5):
        """最近の予測を取得"""
        if not self.predictions:
            return []
        
        # 開催回順にソートして最新のcount件を取得
        sorted_predictions = sorted(self.predictions, key=lambda x: x['round'], reverse=True)
        recent = sorted_predictions[:count]
        
        result = []
        for entry in recent:
            prediction_info = {
                'round': entry['round'],
                'date': entry['date'],
                'prediction_count': len(entry['predictions']),
                'verified': entry['verified'],
                'predictions': entry['predictions']
            }
            
            # 検証済みの場合は結果も含める
            if entry['verified']:
                prediction_info['actual'] = entry['actual']
                prediction_info['matches'] = entry['matches']
                prediction_info['max_matches'] = max(entry['matches']) if entry['matches'] else 0
                prediction_info['avg_matches'] = np.mean(entry['matches']) if entry['matches'] else 0
            
            result.append(prediction_info)
        
        return result
    
    def get_detailed_analysis(self, round_number):
        """指定開催回の詳細分析を取得"""
        entry = self.find_prediction_by_round(round_number)
        if not entry:
            return None
        
        analysis = {
            'round': entry['round'],
            'date': entry['date'],
            'predictions': entry['predictions'],
            'verified': entry['verified']
        }
        
        if entry['verified'] and entry['actual']:
            actual_set = set(entry['actual'])
            
            # 各予測セットの詳細分析
            detailed_results = []
            for i, pred_set in enumerate(entry['predictions']):
                pred_set_int = [int(x) for x in pred_set]
                pred_set_obj = set(pred_set_int)
                
                matched = sorted(list(pred_set_obj & actual_set))
                missed = sorted(list(actual_set - pred_set_obj))
                extra = sorted(list(pred_set_obj - actual_set))
                
                detailed_results.append({
                    'prediction_index': i,
                    'prediction': pred_set_int,
                    'matches': len(matched),
                    'matched_numbers': matched,
                    'missed_numbers': missed,
                    'extra_numbers': extra
                })
            
            analysis['actual'] = entry['actual']
            analysis['detailed_results'] = detailed_results
            analysis['summary'] = {
                'total_predictions': len(entry['predictions']),
                'avg_matches': np.mean(entry['matches']) if entry['matches'] else 0,
                'max_matches': max(entry['matches']) if entry['matches'] else 0,
                'min_matches': min(entry['matches']) if entry['matches'] else 0
            }
        
        return analysis
    
    def remove_prediction(self, round_number):
        """指定開催回の予測を削除"""
        initial_count = len(self.predictions)
        self.predictions = [entry for entry in self.predictions if entry['round'] != round_number]
        
        removed = initial_count - len(self.predictions)
        if removed > 0:
            logger.info(f"第{round_number}回の予測を削除しました")
            
            # 統計を更新
            if any(entry['verified'] for entry in self.predictions):
                self._update_accuracy_stats()
            else:
                self.accuracy_stats = {}
            
            # ファイルに保存
            if self.file_manager:
                self.save_to_csv()
            
            return True
        
        return False
