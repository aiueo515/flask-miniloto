"""
ファイル管理ユーティリティ
モデルや履歴ファイルの保存・読み込みを管理
"""

import os
import pickle
import pandas as pd
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class FileManager:
    """ファイル管理クラス"""
    
    def __init__(self, base_dir='./'):
        self.base_dir = base_dir
        self.model_path = os.path.join(base_dir, 'model.pkl')
        self.history_path = os.path.join(base_dir, 'prediction_history.csv')
        self.data_path = os.path.join(base_dir, 'loto7_data.csv')
        
        # ディレクトリ作成
        os.makedirs(base_dir, exist_ok=True)
    
    def get_file_path(self, filename):
        """ファイルパスを取得"""
        return os.path.join(self.base_dir, filename)
    
    def model_exists(self):
        """モデルファイルの存在確認"""
        return os.path.exists(self.model_path)
    
    def history_exists(self):
        """履歴ファイルの存在確認"""
        return os.path.exists(self.history_path)
    
    def data_cached(self):
        """データキャッシュファイルの存在確認"""
        return os.path.exists(self.data_path)
    
    def save_model(self, prediction_system):
        """予測システムのモデルを保存"""
        try:
            model_data = {
                'trained_models': prediction_system.trained_models,
                'scalers': prediction_system.scalers,
                'model_weights': prediction_system.model_weights,
                'model_scores': prediction_system.model_scores,
                'freq_counter': prediction_system.freq_counter,
                'pair_freq': prediction_system.pair_freq,
                'pattern_stats': prediction_system.pattern_stats,
                'data_count': prediction_system.data_count,
                'saved_at': datetime.now().isoformat()
            }
            
            # 自動照合学習の改善メトリクスも保存
            if hasattr(prediction_system, 'auto_learner') and hasattr(prediction_system.auto_learner, 'improvement_metrics'):
                model_data['improvement_metrics'] = prediction_system.auto_learner.improvement_metrics
            
            with open(self.model_path, 'wb') as f:
                pickle.dump(model_data, f)
            
            logger.info(f"モデルを保存: {self.model_path}")
            return True
            
        except Exception as e:
            logger.error(f"モデル保存エラー: {e}")
            return False
    
    def load_model(self, prediction_system):
        """保存されたモデルを予測システムに読み込み"""
        try:
            if not self.model_exists():
                logger.warning("モデルファイルが存在しません")
                return False
            
            with open(self.model_path, 'rb') as f:
                model_data = pickle.load(f)
            
            # 予測システムにモデルデータを復元
            prediction_system.trained_models = model_data['trained_models']
            prediction_system.scalers = model_data['scalers']
            prediction_system.model_weights = model_data['model_weights']
            prediction_system.model_scores = model_data['model_scores']
            prediction_system.freq_counter = model_data['freq_counter']
            prediction_system.pair_freq = model_data['pair_freq']
            prediction_system.pattern_stats = model_data['pattern_stats']
            prediction_system.data_count = model_data['data_count']
            
            # 改善メトリクスの復元
            if 'improvement_metrics' in model_data:
                if hasattr(prediction_system, 'auto_learner'):
                    prediction_system.auto_learner.improvement_metrics = model_data['improvement_metrics']
            
            logger.info(f"モデルを読み込み: {self.model_path}")
            logger.info(f"学習データ数: {prediction_system.data_count}")
            logger.info(f"モデル数: {len(prediction_system.trained_models)}")
            
            return True
            
        except Exception as e:
            logger.error(f"モデル読み込みエラー: {e}")
            return False
    
    def save_history(self, prediction_history):
        """予測履歴をCSVに保存"""
        try:
            if not prediction_history.predictions:
                logger.info("保存する予測履歴がありません")
                return False
            
            # データフレームに変換
            rows = []
            for entry in prediction_history.predictions:
                base_row = {
                    'round': entry['round'],
                    'date': entry['date'],
                    'verified': entry['verified']
                }
                
                # 各予測セットを行として追加
                for i, pred_set in enumerate(entry['predictions']):
                    row = base_row.copy()
                    row['prediction_idx'] = i
                    for j in range(7):
                        row[f'pred_{j+1}'] = pred_set[j]
                    
                    # 検証済みの場合は実際の番号と一致数も記録
                    if entry['verified'] and entry['actual']:
                        for j in range(7):
                            row[f'actual_{j+1}'] = entry['actual'][j]
                        row['matches'] = entry['matches'][i] if i < len(entry['matches']) else 0
                    
                    rows.append(row)
            
            df = pd.DataFrame(rows)
            df.to_csv(self.history_path, index=False, encoding='utf-8')
            
            logger.info(f"予測履歴をCSVに保存: {self.history_path}")
            return True
            
        except Exception as e:
            logger.error(f"履歴保存エラー: {e}")
            return False
    
    def load_history(self, prediction_history):
        """CSVから予測履歴を読み込み"""
        try:
            if not self.history_exists():
                logger.info("履歴ファイルが存在しません")
                return False
            
            df = pd.read_csv(self.history_path, encoding='utf-8')
            
            # 予測を再構築
            prediction_history.predictions = []
            grouped = df.groupby(['round', 'date'])
            
            for (round_num, date), group in grouped:
                predictions = []
                actual = None
                matches = []
                verified = group['verified'].iloc[0]
                
                for _, row in group.iterrows():
                    # 予測番号を取得
                    pred = [int(row[f'pred_{i+1}']) for i in range(7)]
                    predictions.append(pred)
                    
                    # 実際の番号と一致数を取得
                    if verified and 'actual_1' in row and pd.notna(row['actual_1']):
                        if actual is None:
                            actual = [int(row[f'actual_{i+1}']) for i in range(7)]
                        if 'matches' in row and pd.notna(row['matches']):
                            matches.append(int(row['matches']))
                
                entry = {
                    'round': int(round_num),
                    'date': date,
                    'predictions': predictions,
                    'actual': actual,
                    'matches': matches,
                    'verified': verified
                }
                prediction_history.predictions.append(entry)
            
            # 統計を更新
            if any(entry['verified'] for entry in prediction_history.predictions):
                prediction_history._update_accuracy_stats()
            
            logger.info(f"予測履歴を読み込み: {len(prediction_history.predictions)}回分")
            return True
            
        except Exception as e:
            logger.error(f"履歴読み込みエラー: {e}")
            return False
    
    def save_data_cache(self, data_df):
        """データをキャッシュに保存"""
        try:
            data_df.to_csv(self.data_path, index=False, encoding='utf-8')
            logger.info(f"データをキャッシュに保存: {self.data_path}")
            return True
        except Exception as e:
            logger.error(f"データキャッシュ保存エラー: {e}")
            return False
    
    def load_data_cache(self):
        """キャッシュからデータを読み込み"""
        try:
            if not self.data_cached():
                return None
            
            df = pd.read_csv(self.data_path, encoding='utf-8')
            logger.info(f"キャッシュからデータを読み込み: {len(df)}件")
            return df
        except Exception as e:
            logger.error(f"データキャッシュ読み込みエラー: {e}")
            return None
    
    def get_file_info(self, filename):
        """ファイル情報を取得"""
        file_path = self.get_file_path(filename)
        
        if not os.path.exists(file_path):
            return None
        
        stat = os.stat(file_path)
        return {
            'exists': True,
            'size': stat.st_size,
            'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
            'path': file_path
        }
    
    def cleanup_old_files(self, days=30):
        """古いファイルをクリーンアップ（必要に応じて）"""
        try:
            import time
            current_time = time.time()
            cutoff_time = current_time - (days * 24 * 60 * 60)
            
            cleanup_count = 0
            for root, dirs, files in os.walk(self.base_dir):
                for file in files:
                    if file.endswith('.tmp') or file.endswith('.bak'):
                        file_path = os.path.join(root, file)
                        if os.path.getmtime(file_path) < cutoff_time:
                            os.remove(file_path)
                            cleanup_count += 1
            
            if cleanup_count > 0:
                logger.info(f"古いファイルを{cleanup_count}個削除しました")
            
            return cleanup_count
            
        except Exception as e:
            logger.error(f"ファイルクリーンアップエラー: {e}")
            return 0