"""
ファイル管理ユーティリティ - ミニロト対応完全版
ローカルストレージ対応、モデルや履歴ファイルの保存・読み込みを管理
"""

import os
import pickle
import pandas as pd
import logging
import shutil
import tempfile
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

class FileManager:
    """ファイル管理クラス - ローカルストレージ対応完全版"""
    
    def __init__(self, base_dir=None):
        # 環境変数でローカルストレージを使用するか判定
        self.use_local_storage = os.environ.get('USE_LOCAL_STORAGE', 'false').lower() == 'true'
        
        if self.use_local_storage:
            # ローカルストレージモード（/tmp使用）
            self.data_dir = os.environ.get('DATA_DIR', '/tmp/miniloto_data')
            logger.info(f"📁 ローカルストレージモード: {self.data_dir}")
        else:
            # 通常モード（永続ストレージ）
            self.data_dir = base_dir if base_dir else './data'
            logger.info(f"📁 永続ストレージモード: {self.data_dir}")
        
        # 基本ディレクトリ設定
        self.base_dir = self.data_dir
        self.models_dir = os.path.join(self.data_dir, 'models')
        self.cache_dir = os.path.join(self.data_dir, 'cache')
        self.uploads_dir = os.path.join(self.data_dir, 'uploads')
        self.backups_dir = os.path.join(self.data_dir, 'backups')
        
        # ファイルパス設定
        self.model_path = os.path.join(self.models_dir, 'miniloto_model.pkl')
        self.history_path = os.path.join(self.data_dir, 'prediction_history.csv')
        self.data_cache_path = os.path.join(self.cache_dir, 'miniloto_data.csv')
        self.config_path = os.path.join(self.data_dir, 'config.json')
        
        # ディレクトリ初期化
        self._ensure_directories()
        
        # 起動時情報ログ
        self._log_storage_info()
    
    def _ensure_directories(self):
        """必要なディレクトリを作成"""
        directories = [
            self.data_dir,
            self.models_dir,
            self.cache_dir,
            self.uploads_dir,
            self.backups_dir
        ]
        
        for directory in directories:
            os.makedirs(directory, exist_ok=True)
            logger.debug(f"ディレクトリ確保: {directory}")
    
    def _log_storage_info(self):
        """ストレージ情報をログ出力"""
        try:
            storage_info = self.get_storage_info()
            logger.info(f"💾 ストレージ情報: {storage_info['storage_type']}")
            logger.info(f"📍 データディレクトリ: {storage_info['data_dir']}")
            if storage_info.get('warning'):
                logger.warning(f"⚠️ {storage_info['warning']}")
        except Exception as e:
            logger.warning(f"ストレージ情報取得エラー: {e}")
    
    def get_file_path(self, filename, subdirectory=None):
        """ファイルパスを取得"""
        if subdirectory:
            directory = os.path.join(self.data_dir, subdirectory)
            os.makedirs(directory, exist_ok=True)
            return os.path.join(directory, filename)
        return os.path.join(self.data_dir, filename)
    
    # ===== 存在確認メソッド =====
    
    def model_exists(self):
        """モデルファイルの存在確認"""
        return os.path.exists(self.model_path)
    
    def history_exists(self):
        """履歴ファイルの存在確認"""
        return os.path.exists(self.history_path)
    
    def data_cached(self):
        """データキャッシュファイルの存在確認"""
        return os.path.exists(self.data_cache_path)
    
    def config_exists(self):
        """設定ファイルの存在確認"""
        return os.path.exists(self.config_path)
    
    # ===== モデル保存・読み込み =====
    
    def save_model(self, prediction_system):
        """予測システムのモデルを保存（バックアップ機能付き）"""
        try:
            # 既存モデルのバックアップ
            if self.model_exists():
                self._backup_file(self.model_path, 'model_backup')
            
            model_data = {
                'trained_models': prediction_system.trained_models,
                'scalers': prediction_system.scalers,
                'model_weights': prediction_system.model_weights,
                'model_scores': prediction_system.model_scores,
                'freq_counter': prediction_system.freq_counter,
                'pair_freq': prediction_system.pair_freq,
                'pattern_stats': prediction_system.pattern_stats,
                'data_count': prediction_system.data_count,
                'saved_at': datetime.now().isoformat(),
                # ミニロト対応の識別子
                'game_type': 'miniloto',
                'number_range': 31,
                'select_count': 5,
                'version': '1.0.0'
            }
            
            # 自動照合学習の改善メトリクスも保存
            if hasattr(prediction_system, 'auto_learner') and \
               hasattr(prediction_system.auto_learner, 'improvement_metrics'):
                model_data['improvement_metrics'] = prediction_system.auto_learner.improvement_metrics
            
            # 一時ファイルに保存してから移動（アトミック保存）
            temp_path = self.model_path + '.tmp'
            with open(temp_path, 'wb') as f:
                pickle.dump(model_data, f)
            
            # 保存成功時のみ正式ファイルに移動
            shutil.move(temp_path, self.model_path)
            
            logger.info(f"✅ ミニロトモデルを保存: {self.model_path}")
            logger.info(f"📊 学習データ数: {prediction_system.data_count}")
            logger.info(f"🤖 モデル数: {len(prediction_system.trained_models)}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ モデル保存エラー: {e}")
            # 一時ファイルのクリーンアップ
            temp_path = self.model_path + '.tmp'
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return False
    
    def load_model(self, prediction_system):
        """保存されたモデルを予測システムに読み込み"""
        try:
            if not self.model_exists():
                logger.warning("⚠️ モデルファイルが存在しません")
                return False
            
            with open(self.model_path, 'rb') as f:
                model_data = pickle.load(f)
            
            # バージョン・互換性チェック
            game_type = model_data.get('game_type', 'unknown')
            if game_type == 'loto7':
                logger.warning("⚠️ ロト7用モデルが検出されました。ミニロト用に新規学習が推奨されます。")
            elif game_type != 'miniloto':
                logger.warning(f"⚠️ 未知のゲームタイプ: {game_type}")
            
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
            
            saved_at = model_data.get('saved_at', '不明')
            logger.info(f"✅ ミニロトモデルを読み込み: {self.model_path}")
            logger.info(f"📊 学習データ数: {prediction_system.data_count}")
            logger.info(f"🤖 モデル数: {len(prediction_system.trained_models)}")
            logger.info(f"🕒 保存日時: {saved_at}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ モデル読み込みエラー: {e}")
            return False
    
    # ===== 履歴保存・読み込み =====
    
    def save_history(self, prediction_history):
        """予測履歴をCSVに保存（バックアップ機能付き）"""
        try:
            if not prediction_history.predictions:
                logger.info("保存する予測履歴がありません")
                return False
            
            # 既存履歴のバックアップ
            if self.history_exists():
                self._backup_file(self.history_path, 'history_backup')
            
            # データフレームに変換
            rows = []
            for entry in prediction_history.predictions:
                base_row = {
                    'round': entry['round'],
                    'date': entry['date'],
                    'verified': entry['verified'],
                    'created_at': entry.get('created_at', ''),
                    'game_type': 'miniloto'
                }
                
                # 各予測セットを行として追加（ミニロトは5個）
                for i, pred_set in enumerate(entry['predictions']):
                    row = base_row.copy()
                    row['prediction_idx'] = i
                    for j in range(5):  # ミニロトは5個
                        row[f'pred_{j+1}'] = pred_set[j] if j < len(pred_set) else None
                    
                    # 検証済みの場合は実際の番号と一致数も記録
                    if entry['verified'] and entry.get('actual'):
                        for j in range(5):  # ミニロトは5個
                            if j < len(entry['actual']):
                                row[f'actual_{j+1}'] = entry['actual'][j]
                        if 'matches' in entry and i < len(entry['matches']):
                            row['matches'] = entry['matches'][i]
                    
                    rows.append(row)
            
            df = pd.DataFrame(rows)
            
            # 一時ファイルに保存してから移動
            temp_path = self.history_path + '.tmp'
            df.to_csv(temp_path, index=False, encoding='utf-8')
            shutil.move(temp_path, self.history_path)
            
            logger.info(f"✅ ミニロト予測履歴をCSVに保存: {self.history_path}")
            logger.info(f"📝 保存件数: {len(rows)}行")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ 履歴保存エラー: {e}")
            # 一時ファイルのクリーンアップ
            temp_path = self.history_path + '.tmp'
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return False
    
    def load_history(self, prediction_history):
        """CSVから予測履歴を読み込み"""
        try:
            if not self.history_exists():
                logger.info("予測履歴ファイルが存在しません")
                return False
            
            df = pd.read_csv(self.history_path, encoding='utf-8')
            
            if df.empty:
                logger.info("予測履歴は空です")
                return True
            
            # 履歴を再構築
            prediction_history.predictions = []
            
            # round でグループ化
            for round_num in df['round'].unique():
                round_data = df[df['round'] == round_num]
                
                if round_data.empty:
                    continue
                
                first_row = round_data.iloc[0]
                
                # 予測セットを収集
                predictions = []
                for _, row in round_data.iterrows():
                    pred_set = []
                    for j in range(5):  # ミニロトは5個
                        val = row.get(f'pred_{j+1}')
                        if pd.notna(val):
                            pred_set.append(int(val))
                    
                    if len(pred_set) == 5:
                        predictions.append(pred_set)
                
                # エントリ作成
                entry = {
                    'round': int(first_row['round']),
                    'date': first_row['date'],
                    'predictions': predictions,
                    'verified': bool(first_row['verified']),
                    'created_at': first_row.get('created_at', '')
                }
                
                # 検証情報があれば追加
                if entry['verified']:
                    actual = []
                    matches = []
                    
                    for j in range(5):  # ミニロトは5個
                        val = first_row.get(f'actual_{j+1}')
                        if pd.notna(val):
                            actual.append(int(val))
                    
                    if len(actual) == 5:
                        entry['actual'] = actual
                        
                        # 各予測セットの一致数を計算
                        for pred_set in predictions:
                            match_count = len(set(pred_set) & set(actual))
                            matches.append(match_count)
                        
                        entry['matches'] = matches
                
                prediction_history.predictions.append(entry)
            
            logger.info(f"✅ ミニロト予測履歴をCSVから読み込み: {len(prediction_history.predictions)}ラウンド")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ 履歴読み込みエラー: {e}")
            return False
    
    # ===== データキャッシュ =====
    
    def save_data_cache(self, data):
        """データをキャッシュに保存"""
        try:
            if data is None or len(data) == 0:
                logger.warning("保存するデータがありません")
                return False
            
            # 既存キャッシュのバックアップ
            if self.data_cached():
                self._backup_file(self.data_cache_path, 'cache_backup')
            
            # 一時ファイルに保存してから移動
            temp_path = self.data_cache_path + '.tmp'
            data.to_csv(temp_path, index=False, encoding='utf-8')
            shutil.move(temp_path, self.data_cache_path)
            
            logger.info(f"✅ ミニロトデータをキャッシュに保存: {self.data_cache_path}")
            logger.info(f"📊 保存件数: {len(data)}件")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ データキャッシュ保存エラー: {e}")
            # 一時ファイルのクリーンアップ
            temp_path = self.data_cache_path + '.tmp'
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return False
    
    def load_data_cache(self):
        """キャッシュからデータを読み込み"""
        try:
            if not self.data_cached():
                logger.info("データキャッシュファイルが存在しません")
                return None
            
            df = pd.read_csv(self.data_cache_path, encoding='utf-8')
            logger.info(f"✅ キャッシュからミニロトデータを読み込み: {len(df)}件")
            
            return df
            
        except Exception as e:
            logger.error(f"❌ データキャッシュ読み込みエラー: {e}")
            return None
    
    # ===== 設定管理 =====
    
    def save_config(self, config_data):
        """設定をJSONファイルに保存"""
        try:
            import json
            
            # 既存設定のバックアップ
            if self.config_exists():
                self._backup_file(self.config_path, 'config_backup')
            
            # タイムスタンプ追加
            config_data['saved_at'] = datetime.now().isoformat()
            config_data['game_type'] = 'miniloto'
            
            # 一時ファイルに保存してから移動
            temp_path = self.config_path + '.tmp'
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, indent=2, ensure_ascii=False)
            shutil.move(temp_path, self.config_path)
            
            logger.info(f"✅ 設定を保存: {self.config_path}")
            return True
            
        except Exception as e:
            logger.error(f"❌ 設定保存エラー: {e}")
            # 一時ファイルのクリーンアップ
            temp_path = self.config_path + '.tmp'
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return False
    
    def load_config(self):
        """設定をJSONファイルから読み込み"""
        try:
            import json
            
            if not self.config_exists():
                logger.info("設定ファイルが存在しません")
                return {}
            
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
            
            logger.info(f"✅ 設定を読み込み: {self.config_path}")
            return config_data
            
        except Exception as e:
            logger.error(f"❌ 設定読み込みエラー: {e}")
            return {}
    
    # ===== ファイル操作・管理 =====
    
    def get_file_info(self, filename):
        """ファイル情報を取得"""
        file_path = self.get_file_path(filename)
        
        if not os.path.exists(file_path):
            return {
                'exists': False,
                'path': file_path
            }
        
        try:
            stat = os.stat(file_path)
            return {
                'exists': True,
                'size': stat.st_size,
                'size_mb': round(stat.st_size / 1024 / 1024, 2),
                'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'path': file_path,
                'readable': os.access(file_path, os.R_OK),
                'writable': os.access(file_path, os.W_OK)
            }
        except Exception as e:
            return {
                'exists': True,
                'path': file_path,
                'error': str(e)
            }
    
    def get_storage_info(self):
        """ストレージ情報を取得"""
        try:
            total, used, free = shutil.disk_usage(self.data_dir)
            
            file_counts = self._count_files()
            
            return {
                'storage_type': 'local' if self.use_local_storage else 'persistent',
                'data_dir': self.data_dir,
                'total_mb': round(total / 1024 / 1024, 1),
                'used_mb': round(used / 1024 / 1024, 1),
                'free_mb': round(free / 1024 / 1024, 1),
                'file_counts': file_counts,
                'warning': 'ローカルストレージ：再起動で消失' if self.use_local_storage else None,
                'directories': {
                    'models': self.models_dir,
                    'cache': self.cache_dir,
                    'uploads': self.uploads_dir,
                    'backups': self.backups_dir
                }
            }
        except Exception as e:
            return {
                'storage_type': 'local' if self.use_local_storage else 'persistent',
                'data_dir': self.data_dir,
                'error': str(e)
            }
    
    def _count_files(self):
        """各ディレクトリのファイル数をカウント"""
        counts = {}
        directories = {
            'total': self.data_dir,
            'models': self.models_dir,
            'cache': self.cache_dir,
            'uploads': self.uploads_dir,
            'backups': self.backups_dir
        }
        
        for name, directory in directories.items():
            try:
                if os.path.exists(directory):
                    counts[name] = len([f for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f))])
                else:
                    counts[name] = 0
            except Exception:
                counts[name] = 0
        
        return counts
    
    def _backup_file(self, file_path, backup_prefix):
        """ファイルをバックアップ"""
        try:
            if not os.path.exists(file_path):
                return False
            
            filename = os.path.basename(file_path)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_filename = f"{backup_prefix}_{timestamp}_{filename}"
            backup_path = os.path.join(self.backups_dir, backup_filename)
            
            shutil.copy2(file_path, backup_path)
            logger.debug(f"バックアップ作成: {backup_path}")
            
            return True
        except Exception as e:
            logger.warning(f"バックアップ作成エラー: {e}")
            return False
    
    def cleanup_old_files(self, days=30):
        """古いファイルをクリーンアップ"""
        try:
            import time
            current_time = time.time()
            cutoff_time = current_time - (days * 24 * 60 * 60)
            
            cleanup_count = 0
            cleanup_size = 0
            
            # バックアップディレクトリから古いファイルを削除
            if os.path.exists(self.backups_dir):
                for file in os.listdir(self.backups_dir):
                    file_path = os.path.join(self.backups_dir, file)
                    if os.path.isfile(file_path):
                        if os.path.getmtime(file_path) < cutoff_time:
                            file_size = os.path.getsize(file_path)
                            os.remove(file_path)
                            cleanup_count += 1
                            cleanup_size += file_size
            
            # 一時ファイルのクリーンアップ
            for root, dirs, files in os.walk(self.data_dir):
                for file in files:
                    if file.endswith('.tmp') or file.endswith('.bak'):
                        file_path = os.path.join(root, file)
                        try:
                            if os.path.getmtime(file_path) < cutoff_time:
                                file_size = os.path.getsize(file_path)
                                os.remove(file_path)
                                cleanup_count += 1
                                cleanup_size += file_size
                        except Exception:
                            pass
            
            if cleanup_count > 0:
                cleanup_size_mb = round(cleanup_size / 1024 / 1024, 2)
                logger.info(f"🧹 古いファイルを{cleanup_count}個削除しました（{cleanup_size_mb}MB解放）")
            
            return {
                'files_deleted': cleanup_count,
                'space_freed_mb': round(cleanup_size / 1024 / 1024, 2)
            }
            
        except Exception as e:
            logger.error(f"❌ ファイルクリーンアップエラー: {e}")
            return {
                'files_deleted': 0,
                'space_freed_mb': 0,
                'error': str(e)
            }
    
    # ===== アップロード・ダウンロード支援 =====
    
    def get_upload_path(self, filename):
        """アップロード用ファイルパスを取得"""
        return os.path.join(self.uploads_dir, filename)
    
    def save_uploaded_file(self, file_obj, filename):
        """アップロードされたファイルを保存"""
        try:
            upload_path = self.get_upload_path(filename)
            file_obj.save(upload_path)
            
            # ファイル情報を取得
            file_info = self.get_file_info(os.path.join('uploads', filename))
            
            logger.info(f"✅ ファイルアップロード完了: {upload_path}")
            logger.info(f"📊 ファイルサイズ: {file_info.get('size_mb', 0)}MB")
            
            return upload_path
            
        except Exception as e:
            logger.error(f"❌ ファイルアップロードエラー: {e}")
            return None
    
    def get_download_info(self, file_type):
        """ダウンロード用ファイル情報を取得"""
        file_paths = {
            'model': self.model_path,
            'history': self.history_path,
            'data': self.data_cache_path,
            'config': self.config_path
        }
        
        if file_type not in file_paths:
            return None
        
        file_path = file_paths[file_type]
        if not os.path.exists(file_path):
            return None
        
        return {
            'path': file_path,
            'filename': os.path.basename(file_path),
            'info': self.get_file_info(os.path.basename(file_path))
        }
    
    def export_all_data(self):
        """全データのエクスポート用情報を取得"""
        export_info = {
            'timestamp': datetime.now().isoformat(),
            'game_type': 'miniloto',
            'storage_type': 'local' if self.use_local_storage else 'persistent',
            'files': {}
        }
        
        # 各ファイルの情報を収集
        file_types = ['model', 'history', 'data', 'config']
        for file_type in file_types:
            download_info = self.get_download_info(file_type)
            if download_info:
                export_info['files'][file_type] = {
                    'available': True,
                    'filename': download_info['filename'],
                    'size_mb': download_info['info'].get('size_mb', 0),
                    'modified': download_info['info'].get('modified', '')
                }
            else:
                export_info['files'][file_type] = {'available': False}
        
        return export_info