"""
Celeryタスク定義（段階的学習対応版）
各学習段階を独立したタスクとして実行
"""

import traceback
import logging
from celery import current_task
from celery_app import celery_app
from models.prediction_system import AutoFetchEnsembleLoto7
from utils.file_manager import FileManager

logger = logging.getLogger(__name__)

def update_task_progress(current, total, status_message):
    """タスクの進捗を更新"""
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

# === 既存タスク（そのまま維持） ===

@celery_app.task(bind=True, name='tasks.heavy_init_task')
def heavy_init_task(self):
    """重いコンポーネントの初期化タスク"""
    try:
        update_task_progress(0, 4, "初期化を開始しています...")
        
        file_manager = FileManager()
        update_task_progress(1, 4, "ファイル管理器を初期化しました")
        
        prediction_system = AutoFetchEnsembleLoto7()
        prediction_system.set_file_manager(file_manager)
        update_task_progress(2, 4, "予測システムを初期化しました")
        
        models_loaded = False
        if file_manager.model_exists():
            try:
                models_loaded = prediction_system.load_models()
                update_task_progress(3, 4, "保存済みモデルを読み込みました")
            except Exception as e:
                logger.warning(f"モデル読み込み警告: {e}")
        
        data_loaded = False
        try:
            data_loaded = prediction_system.data_fetcher.fetch_latest_data()
            if data_loaded:
                update_task_progress(4, 4, "データ取得が完了しました")
            else:
                update_task_progress(4, 4, "データ取得に失敗しましたが、続行可能です")
        except Exception as e:
            logger.warning(f"データ取得警告: {e}")
        
        return {
            'status': 'success',
            'message': '重いコンポーネントの初期化が完了しました',
            'models_loaded': models_loaded,
            'data_loaded': data_loaded,
            'latest_round': prediction_system.data_fetcher.latest_round
        }
        
    except Exception as e:
        logger.error(f"重い初期化タスクエラー: {e}")
        return {
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc()
        }

@celery_app.task(bind=True, name='tasks.predict_task')
def predict_task(self, round_number=None):
    """予測生成タスク"""
    try:
        update_task_progress(0, 3, "予測準備を開始しています...")
        
        file_manager = FileManager()
        prediction_system = AutoFetchEnsembleLoto7()
        prediction_system.set_file_manager(file_manager)
        
        prediction_system.load_models()
        prediction_system.history.load_from_csv()
        
        update_task_progress(1, 3, "データを取得しています...")
        
        if not prediction_system.data_fetcher.fetch_latest_data():
            raise Exception("データ取得に失敗しました")
        
        update_task_progress(2, 3, "予測を生成しています...")
        
        predictions, next_info = prediction_system.predict_next_round(20, use_learning=True)
        
        if not predictions:
            raise Exception("予測生成に失敗しました")
        
        update_task_progress(3, 3, "予測生成が完了しました")
        
        return {
            'status': 'success',
            'message': '予測生成が完了しました',
            'predictions': predictions,
            'next_info': next_info
        }
        
    except Exception as e:
        logger.error(f"予測タスクエラー: {e}")
        return {
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc()
        }

# === 🔥 新規追加：段階的学習タスク ===

@celery_app.task(bind=True, name='tasks.progressive_learning_stage_task')
def progressive_learning_stage_task(self, stage_id):
    """段階的学習の単一段階実行タスク"""
    try:
        update_task_progress(0, 5, f"段階的学習準備: {stage_id}")
        
        # システム初期化
        file_manager = FileManager()
        prediction_system = AutoFetchEnsembleLoto7()
        prediction_system.set_file_manager(file_manager)
        
        # 保存済みデータ読み込み
        prediction_system.load_models()
        prediction_system.history.load_from_csv()
        
        update_task_progress(1, 5, "段階的学習マネージャー初期化中...")
        
        # 段階的学習マネージャー初期化
        from models.progressive_learning import ProgressiveLearningManager
        learning_manager = ProgressiveLearningManager(prediction_system)
        learning_manager.load_learning_state()
        
        update_task_progress(2, 5, f"学習段階 {stage_id} を開始しています...")
        
        # 段階実行
        result = learning_manager.execute_learning_stage(stage_id)
        
        update_task_progress(3, 5, "結果を保存中...")
        
        # モデル・状態保存
        file_manager.save_model(prediction_system)
        learning_manager.save_learning_state()
        
        update_task_progress(4, 5, "学習進捗を更新中...")
        
        # 進捗情報取得
        progress_info = learning_manager.get_learning_progress()
        
        update_task_progress(5, 5, f"段階 {stage_id} が完了しました")
        
        return {
            'status': 'success',
            'message': f'学習段階 {stage_id} が完了しました',
            'stage_result': result,
            'learning_progress': progress_info
        }
        
    except Exception as e:
        logger.error(f"段階的学習タスクエラー ({stage_id}): {e}")
        return {
            'status': 'error',
            'message': str(e),
            'stage_id': stage_id,
            'traceback': traceback.format_exc()
        }

@celery_app.task(bind=True, name='tasks.get_learning_progress_task')
def get_learning_progress_task(self):
    """学習進捗状況を取得するタスク"""
    try:
        file_manager = FileManager()
        prediction_system = AutoFetchEnsembleLoto7()
        prediction_system.set_file_manager(file_manager)
        
        from models.progressive_learning import ProgressiveLearningManager
        learning_manager = ProgressiveLearningManager(prediction_system)
        learning_manager.load_learning_state()
        
        progress_info = learning_manager.get_learning_progress()
        
        return {
            'status': 'success',
            'progress': progress_info
        }
        
    except Exception as e:
        logger.error(f"学習進捗取得タスクエラー: {e}")
        return {
            'status': 'error',
            'message': str(e)
        }

@celery_app.task(bind=True, name='tasks.reset_learning_progress_task')
def reset_learning_progress_task(self):
    """学習進捗をリセットするタスク"""
    try:
        file_manager = FileManager()
        prediction_system = AutoFetchEnsembleLoto7()
        prediction_system.set_file_manager(file_manager)
        
        from models.progressive_learning import ProgressiveLearningManager
        learning_manager = ProgressiveLearningManager(prediction_system)
        learning_manager.reset_learning_progress()
        
        return {
            'status': 'success',
            'message': '学習進捗をリセットしました'
        }
        
    except Exception as e:
        logger.error(f"学習進捗リセットタスクエラー: {e}")
        return {
            'status': 'error',
            'message': str(e)
        }

# === 既存の一括学習タスク（後方互換性のため維持） ===

@celery_app.task(bind=True, name='tasks.train_model_task')
def train_model_task(self, options=None):
    """モデル学習タスク（一括処理版）"""
    try:
        if options is None:
            options = {}
        
        update_task_progress(0, 5, "学習準備を開始しています...")
        
        # システム初期化
        file_manager = FileManager()
        prediction_system = AutoFetchEnsembleLoto7()
        prediction_system.set_file_manager(file_manager)
        
        update_task_progress(1, 5, "データを取得しています...")
        
        # データ取得
        if not prediction_system.data_fetcher.fetch_latest_data():
            raise Exception("データ取得に失敗しました")
        
        update_task_progress(2, 5, "モデル学習を開始しています...")
        
        # 学習実行
        force_full_train = options.get('force_full_train', False)
        run_timeseries_validation = options.get('run_timeseries_validation', True)
        run_auto_verification = options.get('run_auto_verification', True)
        
        training_success = prediction_system.auto_setup_and_train(
            force_full_train=force_full_train
        )
        
        if not training_success:
            raise Exception("モデル学習に失敗しました")
        
        update_task_progress(3, 5, "検証処理を実行しています...")
        
        # オプション処理
        results = {
            "training": {
                "success": True,
                "model_count": len(prediction_system.trained_models),
                "data_count": prediction_system.data_count,
                "model_scores": prediction_system.model_scores
            }
        }
        
        # 時系列検証
        if run_timeseries_validation:
            try:
                validation_result = prediction_system.run_timeseries_validation()
                results["timeseries_validation"] = {
                    "success": validation_result is not None,
                    "result": validation_result
                }
            except Exception as e:
                results["timeseries_validation"] = {
                    "success": False,
                    "error": str(e)
                }
        
        update_task_progress(4, 5, "保存処理を実行しています...")
        
        # 自動照合学習
        if run_auto_verification:
            try:
                verification_result = prediction_system.run_auto_verification_learning()
                results["auto_verification"] = {
                    "success": verification_result is not None,
                    "verified_count": verification_result.get('verified_count', 0) if verification_result else 0,
                    "improvements": verification_result.get('improvements', {}) if verification_result else {}
                }
            except Exception as e:
                results["auto_verification"] = {
                    "success": False,
                    "error": str(e)
                }
        
        # ファイル保存
        file_manager.save_model(prediction_system)
        file_manager.save_history(prediction_system.history)
        
        update_task_progress(5, 5, "学習処理が完了しました")
        
        return {
            'status': 'success',
            'message': '学習処理が完了しました',
            'results': results
        }
        
    except Exception as e:
        logger.error(f"学習タスクエラー: {e}")
        return {
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc()
        }

@celery_app.task(bind=True, name='tasks.validation_task')
def validation_task(self):
    """時系列検証タスク（一括処理版）"""
    try:
        update_task_progress(0, 3, "検証準備を開始しています...")
        
        # システム初期化
        file_manager = FileManager()
        prediction_system = AutoFetchEnsembleLoto7()
        prediction_system.set_file_manager(file_manager)
        
        prediction_system.load_models()
        
        update_task_progress(1, 3, "データを取得しています...")
        
        if not prediction_system.data_fetcher.fetch_latest_data():
            raise Exception("データ取得に失敗しました")
        
        update_task_progress(2, 3, "時系列検証を実行しています...")
        
        # 検証実行
        validation_result = prediction_system.run_timeseries_validation()
        
        update_task_progress(3, 3, "検証が完了しました")
        
        return {
            'status': 'success',
            'message': '時系列検証が完了しました',
            'result': validation_result
        }
        
    except Exception as e:
        logger.error(f"検証タスクエラー: {e}")
        return {
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc()
        }