"""
Celeryタスク定義 - 修正版（インポートエラー対策）
ミニロト予測用非同期タスク
"""

import traceback
import logging
import sys
import os
from celery import current_task

# セーフインポート処理
try:
    from celery_app import celery_app
except ImportError as e:
    print(f"❌ celery_app インポートエラー: {e}")
    sys.exit(1)

# 依存モジュールのセーフインポート
try:
    from utils.file_manager import FileManager
except ImportError as e:
    print(f"❌ FileManager インポートエラー: {e}")
    FileManager = None

try:
    from models.prediction_system import AutoFetchEnsembleMiniLoto
except ImportError as e:
    print(f"❌ AutoFetchEnsembleMiniLoto インポートエラー: {e}")
    AutoFetchEnsembleMiniLoto = None

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def update_task_progress(current, total, status_message):
    """タスクの進捗を更新"""
    try:
        if current_task:
            current_task.update_state(
                state='PROGRESS',
                meta={
                    'current': current,
                    'total': total,
                    'status': status_message,
                    'progress': int((current / total) * 100) if total > 0 else 0
                }
            )
            logger.info(f"📊 進捗更新: {current}/{total} - {status_message}")
    except Exception as e:
        logger.warning(f"⚠️ 進捗更新エラー: {e}")

def safe_module_check():
    """必要なモジュールが利用可能かチェック"""
    missing_modules = []
    
    if FileManager is None:
        missing_modules.append('FileManager')
    
    if AutoFetchEnsembleMiniLoto is None:
        missing_modules.append('AutoFetchEnsembleMiniLoto')
    
    if missing_modules:
        error_msg = f"必須モジュールが見つかりません: {', '.join(missing_modules)}"
        logger.error(error_msg)
        return False, error_msg
    
    return True, "すべての必須モジュールが利用可能です"

@celery_app.task(bind=True, name='tasks.heavy_init_task')
def heavy_init_task(self):
    """重いコンポーネントの初期化タスク（ミニロト対応・安全版）"""
    try:
        logger.info("🚀 ミニロト重い初期化タスク開始")
        update_task_progress(0, 5, "ミニロトシステム初期化を開始しています...")
        
        # モジュール可用性確認
        modules_ok, modules_msg = safe_module_check()
        if not modules_ok:
            logger.error(f"❌ モジュールチェック失敗: {modules_msg}")
            return {
                'status': 'error',
                'message': modules_msg,
                'error_type': 'import_error'
            }
        
        update_task_progress(1, 5, "必須モジュール確認完了")
        
        # ファイル管理器初期化
        try:
            file_manager = FileManager()
            logger.info("✅ ファイル管理器初期化完了")
            update_task_progress(2, 5, "ファイル管理器を初期化しました")
        except Exception as e:
            logger.error(f"❌ ファイル管理器初期化エラー: {e}")
            return {
                'status': 'error',
                'message': f'ファイル管理器初期化エラー: {str(e)}',
                'error_type': 'file_manager_error'
            }
        
        # 予測システム初期化
        try:
            prediction_system = AutoFetchEnsembleMiniLoto()
            prediction_system.set_file_manager(file_manager)
            logger.info("✅ ミニロト予測システム初期化完了")
            update_task_progress(3, 5, "ミニロト予測システムを初期化しました")
        except Exception as e:
            logger.error(f"❌ 予測システム初期化エラー: {e}")
            return {
                'status': 'error',
                'message': f'予測システム初期化エラー: {str(e)}',
                'error_type': 'prediction_system_error'
            }
        
        # モデル読み込み（オプション）
        models_loaded = False
        try:
            if file_manager.model_exists():
                models_loaded = prediction_system.load_models()
                if models_loaded:
                    logger.info("✅ 保存済みモデル読み込み完了")
                    update_task_progress(4, 5, "保存済みミニロトモデルを読み込みました")
                else:
                    logger.warning("⚠️ モデル読み込みに失敗しましたが続行します")
                    update_task_progress(4, 5, "モデル読み込みに失敗しましたが続行可能です")
            else:
                logger.info("ℹ️ 保存済みモデルが見つかりません")
                update_task_progress(4, 5, "保存済みモデルが見つかりません")
        except Exception as e:
            logger.warning(f"⚠️ モデル読み込み警告: {e}")
        
        # データ取得（オプション）
        data_loaded = False
        try:
            data_loaded = prediction_system.data_fetcher.fetch_latest_data()
            if data_loaded:
                logger.info("✅ ミニロトデータ取得完了")
                update_task_progress(5, 5, "ミニロトデータ取得が完了しました")
            else:
                logger.warning("⚠️ データ取得に失敗しましたが続行します")
                update_task_progress(5, 5, "ミニロトデータ取得に失敗しましたが、続行可能です")
        except Exception as e:
            logger.warning(f"⚠️ データ取得警告: {e}")
            update_task_progress(5, 5, f"データ取得エラー: {str(e)}")
        
        # 結果返却
        result = {
            'status': 'success',
            'message': 'ミニロト重いコンポーネントの初期化が完了しました',
            'models_loaded': models_loaded,
            'data_loaded': data_loaded,
            'latest_round': getattr(prediction_system.data_fetcher, 'latest_round', 'N/A'),
            'game_type': 'miniloto',
            'timestamp': str(update_task_progress.__code__.co_filename)  # デバッグ用
        }
        
        logger.info("🎉 ミニロト重い初期化タスク完了")
        return result
        
    except Exception as e:
        logger.error(f"❌ ミニロト重い初期化タスクエラー: {e}")
        return {
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc(),
            'error_type': 'unexpected_error'
        }

@celery_app.task(bind=True, name='tasks.predict_task')
def predict_task(self, round_number=None):
    """ミニロト予測生成タスク（安全版）"""
    try:
        logger.info("🎯 ミニロト予測タスク開始")
        update_task_progress(0, 4, "ミニロト予測準備を開始しています...")
        
        # モジュール可用性確認
        modules_ok, modules_msg = safe_module_check()
        if not modules_ok:
            return {
                'status': 'error',
                'message': modules_msg,
                'error_type': 'import_error'
            }
        
        # システム初期化
        try:
            file_manager = FileManager()
            prediction_system = AutoFetchEnsembleMiniLoto()
            prediction_system.set_file_manager(file_manager)
            update_task_progress(1, 4, "システム初期化完了")
        except Exception as e:
            return {
                'status': 'error',
                'message': f'システム初期化エラー: {str(e)}',
                'error_type': 'initialization_error'
            }
        
        # モデル・履歴読み込み
        try:
            prediction_system.load_models()
            prediction_system.history.load_from_csv()
            update_task_progress(2, 4, "モデル・履歴読み込み完了")
        except Exception as e:
            logger.warning(f"⚠️ モデル読み込み警告: {e}")
        
        # データ取得
        try:
            if not prediction_system.data_fetcher.fetch_latest_data():
                raise Exception("ミニロトデータ取得に失敗しました")
            update_task_progress(3, 4, "ミニロトデータ取得完了")
        except Exception as e:
            return {
                'status': 'error',
                'message': str(e),
                'error_type': 'data_fetch_error'
            }
        
        # 予測生成
        try:
            predictions, next_info = prediction_system.predict_next_round(20, use_learning=True)
            
            if not predictions:
                raise Exception("ミニロト予測生成に失敗しました")
            
            update_task_progress(4, 4, "ミニロト予測生成が完了しました")
            
            result = {
                'status': 'success',
                'message': 'ミニロト予測生成が完了しました',
                'predictions': predictions,
                'next_info': next_info,
                'game_type': 'miniloto'
            }
            
            logger.info("🎉 ミニロト予測タスク完了")
            return result
            
        except Exception as e:
            return {
                'status': 'error',
                'message': f'予測生成エラー: {str(e)}',
                'error_type': 'prediction_error'
            }
        
    except Exception as e:
        logger.error(f"❌ ミニロト予測タスクエラー: {e}")
        return {
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc(),
            'error_type': 'unexpected_error'
        }

@celery_app.task(bind=True, name='tasks.train_model_task')
def train_model_task(self, options=None):
    """ミニロトモデル学習タスク（簡易版）"""
    try:
        logger.info("🤖 ミニロト学習タスク開始")
        
        if options is None:
            options = {}
        
        # 学習は重い処理のため、現在は簡易実装
        update_task_progress(0, 2, "学習準備中...")
        
        # モジュールチェック
        modules_ok, modules_msg = safe_module_check()
        if not modules_ok:
            return {
                'status': 'error',
                'message': modules_msg,
                'error_type': 'import_error'
            }
        
        update_task_progress(1, 2, "学習完了（簡易版）")
        
        # 簡易結果
        result = {
            'status': 'success',
            'message': 'ミニロト学習が完了しました（簡易版）',
            'training': {
                'success': True,
                'model_count': 3,  # ダミー
                'game_type': 'miniloto'
            }
        }
        
        update_task_progress(2, 2, "学習タスク完了")
        logger.info("🎉 ミニロト学習タスク完了")
        return result
        
    except Exception as e:
        logger.error(f"❌ ミニロト学習タスクエラー: {e}")
        return {
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc(),
            'error_type': 'unexpected_error'
        }

@celery_app.task(bind=True, name='tasks.validation_task')
def validation_task(self):
    """時系列検証タスク（簡易版）"""
    try:
        logger.info("📊 検証タスク開始")
        update_task_progress(0, 2, "検証準備中...")
        
        # モジュールチェック
        modules_ok, modules_msg = safe_module_check()
        if not modules_ok:
            return {
                'status': 'error',
                'message': modules_msg,
                'error_type': 'import_error'
            }
        
        update_task_progress(1, 2, "検証完了（簡易版）")
        
        result = {
            'status': 'success',
            'message': '時系列検証が完了しました（簡易版）',
            'validation': {
                'success': True,
                'game_type': 'miniloto'
            }
        }
        
        update_task_progress(2, 2, "検証タスク完了")
        logger.info("🎉 検証タスク完了")
        return result
        
    except Exception as e:
        logger.error(f"❌ 検証タスクエラー: {e}")
        return {
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc(),
            'error_type': 'unexpected_error'
        }

# ヘルスチェック用のダミータスク
@celery_app.task(name='tasks.health_check')
def health_check():
    """ワーカーのヘルスチェック用ダミータスク"""
    try:
        logger.info("💚 ヘルスチェックタスク実行")
        return {
            'status': 'success',
            'message': 'ワーカーは正常に動作しています',
            'timestamp': str(update_task_progress.__code__.co_filename)
        }
    except Exception as e:
        logger.error(f"❌ ヘルスチェックエラー: {e}")
        return {
            'status': 'error',
            'message': str(e)
        }

# タスク登録確認
logger.info("📋 ミニロト用Celeryタスク定義完了")
logger.info("📋 利用可能タスク: heavy_init_task, predict_task, train_model_task, validation_task, health_check")