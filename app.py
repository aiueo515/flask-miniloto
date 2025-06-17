"""
Flask-based Loto7 Prediction API
非同期対応・超軽量初期化・メモリ最適化版
"""

from flask import Flask, request, jsonify, send_file, send_from_directory, render_template, make_response
from flask_cors import CORS
import os
import json
import traceback
import gc
import psutil
import pandas as pd
from datetime import datetime
import logging

# Celery
from celery_app import celery_app
import tasks

# 自作モジュール（最小限の読み込み）
from utils.file_manager import FileManager

# Flask設定
app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = './uploads'

# CORS設定（PWA対応）
CORS(app, origins=['*'])

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ディレクトリ作成
os.makedirs('./uploads', exist_ok=True)
os.makedirs('./models', exist_ok=True)
os.makedirs('./data', exist_ok=True)
os.makedirs('./static', exist_ok=True)
os.makedirs('./templates', exist_ok=True)

# グローバル変数（最小限）
file_manager = None

def ultra_light_init():
    """🔥 超軽量初期化 - 1秒以内で完了"""
    global file_manager
    try:
        logger.info("=== 超軽量初期化開始 ===")
        
        # ファイル管理器のみ初期化
        file_manager = FileManager()
        logger.info("✅ ファイル管理器初期化完了")
        
        # メモリ最適化の初期設定
        optimize_memory()
        
        logger.info("🚀 超軽量初期化完了（< 1秒）")
        return True
        
    except Exception as e:
        logger.error(f"🛑 超軽量初期化エラー: {str(e)}")
        return False

def optimize_memory():
    """メモリ使用量を最適化"""
    try:
        # ガベージコレクション実行
        gc.collect()
        
        # メモリ使用量をログ出力
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        memory_mb = memory_info.rss / 1024 / 1024
        logger.info(f"💾 メモリ使用量: {memory_mb:.1f} MB")
        
        # メモリ警告（400MB超過時）
        if memory_mb > 400:
            logger.warning(f"⚠️ メモリ使用量が高いです: {memory_mb:.1f} MB")
            gc.collect()  # 強制ガベージコレクション
            
    except Exception as e:
        logger.error(f"メモリ最適化エラー: {e}")

def create_success_response(data, message="Success"):
    """統一成功レスポンス"""
    response = {
        "status": "success",
        "message": message,
        "timestamp": datetime.now().isoformat(),
        "data": data
    }
    return jsonify(response)

def create_error_response(message, status_code=500, details=None):
    """統一エラーレスポンス作成"""
    response = {
        "status": "error",
        "message": message,
        "timestamp": datetime.now().isoformat(),
        "error_code": status_code
    }
    
    if details:
        response["details"] = details
    
    return jsonify(response), status_code

def get_task_status(task_id):
    """Celeryタスクの状態を取得"""
    try:
        task = celery_app.AsyncResult(task_id)
        
        if task.state == 'PENDING':
            response = {
                'state': task.state,
                'status': 'タスクが開始されていません...'
            }
        elif task.state == 'PROGRESS':
            response = {
                'state': task.state,
                'current': task.info.get('current', 0),
                'total': task.info.get('total', 1),
                'status': task.info.get('status', ''),
                'progress': task.info.get('progress', 0)
            }
        elif task.state == 'SUCCESS':
            response = {
                'state': task.state,
                'result': task.result,
                'status': '完了'
            }
        else:  # FAILURE
            response = {
                'state': task.state,
                'error': str(task.info),
                'status': 'エラーが発生しました'
            }
        
        return response
    except Exception as e:
        logger.error(f"タスク状態取得エラー: {e}")
        return {
            'state': 'FAILURE',
            'error': str(e),
            'status': 'タスク状態の取得に失敗しました'
        }

@app.route('/', methods=['GET'])
def index():
    """PWAメインページ"""
    try:
        # APIアクセスの場合はJSONを返す
        if request.headers.get('Accept') == 'application/json' or 'api' in request.args:
            system_status = {
                "api_version": "1.0.0",
                "game_type": "miniloto",
                "system_initialized": file_manager is not None,
                "async_supported": True,
                "celery_active": True,
                "files_status": {
                    "model_exists": file_manager.model_exists() if file_manager else False,
                    "history_exists": file_manager.history_exists() if file_manager else False,
                    "data_cached": file_manager.data_cached() if file_manager else False
                }
            }
            
            # メモリ情報追加
            try:
                process = psutil.Process(os.getpid())
                memory_mb = process.memory_info().rss / 1024 / 1024
                system_status["memory_usage_mb"] = round(memory_mb, 1)
            except:
                pass
            
            return create_success_response(system_status, "ミニロト予測API is running (Async Mode)")
        
        # 通常のアクセスはPWAページを返す
        return render_template('index.html')
    
    except Exception as e:
        if request.headers.get('Accept') == 'application/json':
            return create_error_response(f"Health check failed: {str(e)}")
        else:
            return f"Error: {str(e)}", 500

# 🔧 予測API修正版（GET/POST両対応）
@app.route('/api/predict', methods=['GET', 'POST'])
def predict_unified():
    """統合予測API（GET/POST両対応）"""
    try:
        logger.info(f"予測API呼び出し: {request.method}")
        
        # POSTの場合はリクエストボディから、GETの場合はクエリパラメータから取得
        if request.method == 'POST':
            request_data = request.get_json() or {}
            force_async = request_data.get('async', True)
        else:
            force_async = request.args.get('async', 'true').lower() == 'true'
        
        logger.info(f"非同期フラグ: {force_async}")
        
        # 非同期処理を推奨
        if not force_async:
            return create_error_response(
                "同期モードは非推奨です。async=true パラメータを使用してください", 
                400
            )
        
        # Celery接続確認
        try:
            inspect = celery_app.control.inspect()
            active = inspect.active()
            if not active:
                logger.warning("Celeryワーカーが検出されません")
                return create_error_response("非同期処理システムが利用できません", 503)
        except Exception as e:
            logger.error(f"Celery接続エラー: {e}")
            return create_error_response(f"非同期処理システムに接続できません: {str(e)}", 503)
        
        # 非同期タスクを開始
        task = tasks.predict_task.delay()
        logger.info(f"予測タスク開始: {task.id}")
        
        return create_success_response({
            'task_id': task.id,
            'status': 'started',
            'message': '予測生成を開始しました',
            'estimated_time': '30-60秒',
            'method': request.method
        }, "予測タスクを開始しました")
        
    except Exception as e:
        logger.error(f"予測API エラー: {e}")
        return create_error_response(f"予測開始に失敗しました: {str(e)}", 500)

# app.py に以下のエンドポイントを追加

@app.route('/api/debug/environment', methods=['GET'])
def debug_environment():
    """環境変数とシステム情報をデバッグ"""
    try:
        env_info = {
            # 環境変数チェック
            'environment_variables': {
                'PYTHON_VERSION': os.environ.get('PYTHON_VERSION', 'NOT_SET'),
                'FLASK_ENV': os.environ.get('FLASK_ENV', 'NOT_SET'),
                'PORT': os.environ.get('PORT', 'NOT_SET'),
                'CELERY_BROKER_URL': os.environ.get('CELERY_BROKER_URL', 'NOT_SET')[:50] + '...' if os.environ.get('CELERY_BROKER_URL') else 'NOT_SET',
                'CELERY_RESULT_BACKEND': os.environ.get('CELERY_RESULT_BACKEND', 'NOT_SET')[:50] + '...' if os.environ.get('CELERY_RESULT_BACKEND') else 'NOT_SET',
            },
            
            # Python情報
            'python_info': {
                'version': os.sys.version,
                'executable': os.sys.executable,
                'platform': os.sys.platform,
            },
            
            # Celery接続テスト
            'celery_info': {},
            
            # ファイルシステム
            'filesystem': {
                'current_directory': os.getcwd(),
                'render_yaml_exists': os.path.exists('./render.yaml'),
                'requirements_exists': os.path.exists('./requirements.txt'),
                'worker_py_exists': os.path.exists('./worker.py'),
            }
        }
        
        # Celery接続テスト
        try:
            from celery_app import celery_app
            inspect = celery_app.control.inspect()
            active_workers = inspect.active()
            env_info['celery_info'] = {
                'celery_imported': True,
                'active_workers': active_workers,
                'broker_url_configured': bool(os.environ.get('CELERY_BROKER_URL')),
            }
        except Exception as e:
            env_info['celery_info'] = {
                'celery_imported': False,
                'error': str(e)
            }
        
        return create_success_response(env_info, "環境デバッグ情報")
        
    except Exception as e:
        logger.error(f"環境デバッグエラー: {e}")
        return create_error_response(f"環境情報取得失敗: {str(e)}", 500)


@app.route('/api/debug/services', methods=['GET']) 
def debug_services():
    """Renderサービス状態の確認"""
    try:
        service_info = {
            'current_service': {
                'name': 'Web Service',
                'type': 'web',
                'process_id': os.getpid(),
            },
            
            'expected_services': {
                'web': 'miniloto-prediction-api',
                'worker': 'miniloto-celery-worker', 
                'redis': 'miniloto-redis'
            },
            
            'render_yaml_config': {},
        }
        
        # render.yamlの内容を読み込んで確認
        try:
            if os.path.exists('./render.yaml'):
                with open('./render.yaml', 'r') as f:
                    yaml_content = f.read()
                    service_info['render_yaml_config'] = {
                        'file_exists': True,
                        'file_size': len(yaml_content),
                        'services_count': yaml_content.count('- type:'),
                        'contains_web': '- type: web' in yaml_content,
                        'contains_worker': '- type: worker' in yaml_content,
                        'contains_redis': '- type: redis' in yaml_content,
                    }
            else:
                service_info['render_yaml_config'] = {
                    'file_exists': False,
                    'error': 'render.yaml not found in current directory'
                }
        except Exception as e:
            service_info['render_yaml_config'] = {
                'file_exists': False,
                'error': str(e)
            }
        
        return create_success_response(service_info, "サービス情報")
        
    except Exception as e:
        logger.error(f"サービスデバッグエラー: {e}")
        return create_error_response(f"サービス情報取得失敗: {str(e)}", 500)


# 🔧 初期化API修正版（GET/POST両対応）
@app.route('/api/init_heavy', methods=['GET', 'POST'])
def init_heavy_unified():
    """統合初期化API（GET/POST両対応）"""
    try:
        logger.info(f"初期化API呼び出し: {request.method}")
        
        # Celery接続確認
        try:
            inspect = celery_app.control.inspect()
            active = inspect.active()
            if not active:
                logger.warning("Celeryワーカーが検出されません")
                return create_error_response("非同期処理システムが利用できません", 503)
        except Exception as e:
            logger.error(f"Celery接続エラー: {e}")
            return create_error_response(f"非同期処理システムに接続できません: {str(e)}", 503)
        
        # 非同期タスクを開始
        task = tasks.heavy_init_task.delay()
        logger.info(f"初期化タスク開始: {task.id}")
        
        return create_success_response({
            'task_id': task.id,
            'status': 'started',
            'message': '重いコンポーネントの初期化を開始しました',
            'estimated_time': '2-5分',
            'method': request.method
        }, "初期化タスクを開始しました")
        
    except Exception as e:
        logger.error(f"初期化API エラー: {e}")
        return create_error_response(f"初期化開始に失敗しました: {str(e)}", 500)

# 🔧 Service Worker診断用API
@app.route('/api/network_test', methods=['GET', 'POST', 'HEAD', 'OPTIONS'])
def network_test():
    """ネットワーク診断用API（全HTTPメソッド対応）"""
    try:
        method = request.method
        headers = dict(request.headers)
        timestamp = datetime.now().isoformat()
        
        response_data = {
            'method': method,
            'timestamp': timestamp,
            'status': 'ok',
            'headers_received': len(headers),
            'user_agent': headers.get('User-Agent', 'Unknown')[:100]
        }
        
        if method == 'HEAD':
            # HEADリクエストの場合はボディなしでレスポンス
            response = make_response('', 200)
            response.headers['Content-Type'] = 'application/json'
            response.headers['X-Test-Status'] = 'ok'
            response.headers['X-Test-Method'] = method
            return response
        elif method == 'OPTIONS':
            # OPTIONSリクエストの場合はCORS対応
            response = make_response('', 200)
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, HEAD, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
            return response
        else:
            # GET/POSTの場合は通常のJSONレスポンス
            return create_success_response(response_data, f"{method} リクエストテスト成功")
            
    except Exception as e:
        logger.error(f"ネットワークテストAPI エラー: {e}")
        return create_error_response(f"ネットワークテストに失敗しました: {str(e)}", 500)

# 🔧 システム状態詳細API
@app.route('/api/system_debug', methods=['GET'])
def get_system_debug_info():
    """システムデバッグ情報取得"""
    try:
        import psutil
        import os
        
        # プロセス情報
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        
        # Celery状態
        celery_status = "unknown"
        celery_workers = 0
        try:
            inspect = celery_app.control.inspect()
            active = inspect.active()
            if active:
                celery_status = "active"
                celery_workers = len(active)
            else:
                celery_status = "inactive"
        except:
            celery_status = "error"
        
        debug_info = {
            'timestamp': datetime.now().isoformat(),
            'process_id': os.getpid(),
            'memory_usage_mb': round(memory_info.rss / 1024 / 1024, 2),
            'cpu_percent': process.cpu_percent(),
            'celery_status': celery_status,
            'celery_workers': celery_workers,
            'file_manager_status': 'initialized' if file_manager else 'not_initialized',
            'async_mode': True,  # アプリは非同期対応
            'environment': os.environ.get('FLASK_ENV', 'production'),
            'request_count': getattr(app, '_request_count', 0)
        }
        
        return create_success_response(debug_info, "システムデバッグ情報を取得しました")
        
    except Exception as e:
        logger.error(f"システムデバッグ情報取得エラー: {e}")
        return create_error_response(f"デバッグ情報取得に失敗しました: {str(e)}", 500)

# === 追加: Service Worker修正用の診断機能 ===
@app.route('/api/debug/service_worker', methods=['GET'])
def debug_service_worker():
    """Service Worker デバッグ情報"""
    try:
        debug_info = {
            'timestamp': datetime.now().isoformat(),
            'server_methods_supported': {
                'GET': True,
                'POST': True, 
                'HEAD': True,
                'OPTIONS': True
            },
            'available_endpoints': [
                '/api/predict',
                '/api/init_heavy', 
                '/api/network_test',
                '/api/system_debug',
                '/api/status'
            ],
            'cors_enabled': True,
            'request_info': {
                'method': request.method,
                'headers': dict(request.headers),
                'path': request.path,
                'args': dict(request.args)
            }
        }
        
        return create_success_response(debug_info, "Service Worker デバッグ情報")
        
    except Exception as e:
        logger.error(f"Service Worker デバッグエラー: {e}")
        return create_error_response(f"Service Worker デバッグ情報取得失敗: {str(e)}", 500)

# === 診断結果確認用のシンプルAPI ===
@app.route('/api/simple_test', methods=['GET', 'POST', 'HEAD'])
def simple_test():
    """最もシンプルなテストAPI"""
    try:
        method = request.method
        
        if method == 'HEAD':
            # HEADリクエスト専用レスポンス
            response = make_response('', 200)
            response.headers['Content-Type'] = 'text/plain'
            response.headers['X-Test-Result'] = 'OK'
            response.headers['X-Method'] = method
            return response
        else:
            # GET/POSTの場合
            return create_success_response({
                'method': method,
                'timestamp': datetime.now().isoformat(),
                'status': 'test_ok'
            }, f"{method} テスト成功")
            
    except Exception as e:
        logger.error(f"シンプルテストエラー: {e}")
        return create_error_response(f"テスト失敗: {str(e)}", 500)

# 🔥 非同期API: モデル学習
@app.route('/api/train', methods=['POST'])
def train_async():
    """非同期モデル学習"""
    try:
        # リクエストパラメータ
        request_data = request.get_json() or {}
        
        # 非同期タスクを開始
        task = tasks.train_model_task.delay(request_data)
        
        return create_success_response({
            'task_id': task.id,
            'status': 'started',
            'message': 'モデル学習を開始しました',
            'estimated_time': '2-5分',
            'options': request_data
        }, "学習タスクを開始しました")
        
    except Exception as e:
        logger.error(f"非同期学習API開始エラー: {e}")
        return create_error_response(f"学習タスクの開始に失敗しました: {str(e)}", 500)

# 🔥 非同期API: 時系列検証
@app.route('/api/validation', methods=['POST'])
def validation_async():
    """非同期時系列検証"""
    try:
        # 非同期タスクを開始
        task = tasks.validation_task.delay()
        
        return create_success_response({
            'task_id': task.id,
            'status': 'started',
            'message': '時系列検証を開始しました',
            'estimated_time': '3-10分'
        }, "検証タスクを開始しました")
        
    except Exception as e:
        logger.error(f"非同期検証API開始エラー: {e}")
        return create_error_response(f"検証タスクの開始に失敗しました: {str(e)}", 500)

# 🔥 タスク状態確認API
@app.route('/api/task/<task_id>', methods=['GET'])
def get_task_status_api(task_id):
    """タスクの実行状態を確認"""
    try:
        task_status = get_task_status(task_id)
        return create_success_response(task_status, "タスク状態を取得しました")
        
    except Exception as e:
        logger.error(f"タスク状態確認エラー: {e}")
        return create_error_response(f"タスク状態の確認に失敗しました: {str(e)}", 500)

# 🔥 タスクキャンセルAPI
@app.route('/api/task/<task_id>/cancel', methods=['POST'])
def cancel_task(task_id):
    """タスクをキャンセル"""
    try:
        celery_app.control.revoke(task_id, terminate=True)
        
        return create_success_response({
            'task_id': task_id,
            'status': 'cancelled'
        }, "タスクをキャンセルしました")
        
    except Exception as e:
        logger.error(f"タスクキャンセルエラー: {e}")
        return create_error_response(f"タスクのキャンセルに失敗しました: {str(e)}", 500)

# 📊 システム状態API（詳細版）
@app.route('/api/status', methods=['GET'])
def get_status():
    """システム状態取得（詳細版）"""
    try:
        # メモリ使用量の取得
        memory_info = {}
        try:
            process = psutil.Process(os.getpid())
            memory_info = {
                'memory_usage_mb': round(process.memory_info().rss / 1024 / 1024, 1),
                'memory_percent': round(process.memory_percent(), 1),
                'cpu_percent': round(process.cpu_percent(), 1)
            }
        except:
            pass
        
        # ファイル状態
        files_status = {}
        if file_manager:
            files_status = {
                "model_exists": file_manager.model_exists(),
                "history_exists": file_manager.history_exists(),
                "data_cached": file_manager.data_cached()
            }
        
        # Celery状態
        celery_status = {}
        try:
            # アクティブなタスク数を確認
            inspect = celery_app.control.inspect()
            active_tasks = inspect.active()
            if active_tasks:
                total_active = sum(len(tasks) for tasks in active_tasks.values())
                celery_status['active_tasks'] = total_active
            else:
                celery_status['active_tasks'] = 0
                
            celery_status['broker_connected'] = True
        except:
            celery_status['broker_connected'] = False
            celery_status['active_tasks'] = 0
        
        status = {
            "initialized": file_manager is not None,
            "async_mode": True,
            "files": files_status,
            "memory": memory_info,
            "celery": celery_status,
            "timestamp": datetime.now().isoformat()
        }
        
        return create_success_response(status)
        
    except Exception as e:
        logger.error(f"ステータス取得エラー: {e}")
        return create_error_response(f"ステータス取得中にエラーが発生しました: {str(e)}", 500)

# 📊 簡単なデータ取得API（同期処理可能）
@app.route('/api/recent_results', methods=['GET'])
def get_recent_results():
    """最近の抽選結果を取得（同期処理）"""
    try:
        if not file_manager:
            return create_error_response("システムが初期化されていません", 500)
        
        # キャッシュファイルが存在するかチェック
        if not file_manager.data_cached():
            return create_error_response("データがキャッシュされていません。初期化を実行してください", 404)
        
        # キャッシュからデータを読み込み（軽量処理）
        cached_data = file_manager.load_data_cache()
        if cached_data is None or len(cached_data) == 0:
            return create_error_response("キャッシュデータが無効です", 500)
        
        count = int(request.args.get('count', 5))
        count = min(max(count, 1), 20)  # 1-20の範囲に制限
        
        # 最新のcount件を取得（軽量処理）
        recent_data = cached_data.nlargest(count, '開催回')
        
        results = []
        for _, row in recent_data.iterrows():
            try:
                round_num = int(row['開催回'])
                main_numbers = []
                
                # メイン数字を取得
                main_cols = ['第1数字', '第2数字', '第3数字', '第4数字', '第5数字', '第6数字', '第7数字']
                for col in main_cols:
                    if col in row.index and not pd.isna(row[col]):
                        main_numbers.append(int(row[col]))
                
                if len(main_numbers) == 7:
                    results.append({
                        'round': round_num,
                        'date': row.get('日付', ''),
                        'main_numbers': sorted(main_numbers),
                        'bonus_numbers': []  # ボーナス数字は省略（軽量化）
                    })
            except:
                continue
        
        response_data = {
            'results': sorted(results, key=lambda x: x['round'], reverse=True),
            'count': len(results),
            'latest_round': int(cached_data['開催回'].max()) if len(cached_data) > 0 else 0
        }
        
        return create_success_response(response_data, f"最近{len(results)}回の結果を取得しました")
        
    except Exception as e:
        logger.error(f"最近の結果取得エラー: {e}")
        return create_error_response(f"最近の結果取得中にエラーが発生しました: {str(e)}", 500)

# 🔥 予測履歴API
@app.route('/api/prediction_history', methods=['GET'])
def get_prediction_history():
    """予測履歴を取得（同期処理）"""
    try:
        count = int(request.args.get('count', 5))
        count = min(max(count, 1), 20)  # 1-20の範囲に制限
        
        if not file_manager:
            return create_error_response("システムが初期化されていません", 500)
        
        # 予測履歴ファイルが存在するかチェック
        if not file_manager.history_exists():
            return create_success_response({
                'predictions': [],
                'total_count': 0,
                'message': '予測履歴がまだありません'
            }, "予測履歴を取得しました（履歴なし）")
        
        # 履歴読み込み（軽量処理）
        try:
            from models.prediction_history import RoundAwarePredictionHistory
            history = RoundAwarePredictionHistory()
            history.set_file_manager(file_manager)
            
            if history.load_from_csv():
                recent_predictions = history.get_recent_predictions(count)
                
                return create_success_response({
                    'predictions': recent_predictions,
                    'total_count': len(history.predictions),
                    'summary': history.get_prediction_summary()
                }, f"最近の予測履歴{len(recent_predictions)}件を取得しました")
            else:
                return create_error_response("予測履歴の読み込みに失敗しました", 500)
                
        except Exception as e:
            logger.error(f"予測履歴処理エラー: {e}")
            return create_error_response(f"予測履歴の処理中にエラーが発生しました: {str(e)}", 500)
        
    except Exception as e:
        logger.error(f"予測履歴API取得エラー: {e}")
        return create_error_response(f"予測履歴取得中にエラーが発生しました: {str(e)}", 500)

# ファイル関連API（軽量処理）
@app.route('/api/download/<filename>', methods=['GET'])
def download_file(filename):
    """ファイルダウンロード"""
    try:
        allowed_files = ['model.pkl', 'prediction_history.csv', 'miniloto.csv']
        
        if filename not in allowed_files:
            return create_error_response(f"ダウンロード許可されていないファイル: {filename}", 400)
        
        if not file_manager:
            return create_error_response("システムが初期化されていません", 500)
        
        file_path = file_manager.get_file_path(filename)
        
        if not os.path.exists(file_path):
            return create_error_response(f"ファイルが見つかりません: {filename}", 404)
        
        return send_file(file_path, as_attachment=True, download_name=filename)
    
    except Exception as e:
        logger.error(f"ダウンロードエラー: {e}")
        return create_error_response(f"ダウンロード中にエラーが発生しました: {str(e)}", 500)

@app.route('/api/upload/<filename>', methods=['POST'])
def upload_file(filename):
    """ファイルアップロード"""
    try:
        allowed_files = ['model.pkl', 'prediction_history.csv', 'miniloto.csv']
        
        if filename not in allowed_files:
            return create_error_response(f"アップロード許可されていないファイル: {filename}", 400)
        
        if not file_manager:
            return create_error_response("システムが初期化されていません", 500)
        
        if 'file' not in request.files:
            return create_error_response("ファイルが指定されていません", 400)
        
        file = request.files['file']
        
        if file.filename == '':
            return create_error_response("ファイル名が空です", 400)
        
        # ファイル保存
        file_path = file_manager.get_file_path(filename)
        file.save(file_path)
        
        return create_success_response({
            "filename": filename,
            "size": os.path.getsize(file_path)
        }, f"{filename}をアップロードしました")
    
    except Exception as e:
        logger.error(f"アップロードエラー: {e}")
        return create_error_response(f"アップロード中にエラーが発生しました: {str(e)}", 500)

# PWA必須ファイル
@app.route('/static/<path:filename>')
def static_files(filename):
    """静的ファイル配信"""
    return send_from_directory('static', filename)

@app.route('/manifest.json')
def manifest():
    """PWA Manifest"""
    return send_from_directory('static', 'manifest.json')

@app.route('/sw.js')
def service_worker():
    """Service Worker"""
    response = send_from_directory('static', 'sw.js')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

# 🔥 メモリ最適化API
@app.route('/api/optimize', methods=['POST'])
def optimize_system():
    """システム最適化（メモリクリーンアップ）"""
    try:
        before_memory = 0
        after_memory = 0
        
        try:
            process = psutil.Process(os.getpid())
            before_memory = process.memory_info().rss / 1024 / 1024
        except:
            pass
        
        # メモリ最適化実行
        optimize_memory()
        
        try:
            process = psutil.Process(os.getpid())
            after_memory = process.memory_info().rss / 1024 / 1024
        except:
            pass
        
        return create_success_response({
            'before_memory_mb': round(before_memory, 1),
            'after_memory_mb': round(after_memory, 1),
            'freed_memory_mb': round(before_memory - after_memory, 1)
        }, "システム最適化が完了しました")
        
    except Exception as e:
        logger.error(f"システム最適化エラー: {e}")
        return create_error_response(f"システム最適化中にエラーが発生しました: {str(e)}", 500)

# エラーハンドラー
@app.errorhandler(404)
def not_found(error):
    return create_error_response("エンドポイントが見つかりません", 404)

@app.errorhandler(500)
def internal_error(error):
    return create_error_response("内部サーバーエラー", 500)

@app.errorhandler(413)
def file_too_large(error):
    return create_error_response("ファイルサイズが大きすぎます（最大16MB）", 413)

# 定期的なメモリ最適化
import threading
import time

def periodic_optimization():
    """定期的なメモリ最適化（5分ごと）"""
    while True:
        time.sleep(300)  # 5分待機
        try:
            optimize_memory()
        except:
            pass

# バックグラウンドでメモリ最適化を実行
if __name__ == '__main__':
    # 定期最適化スレッドを開始
    optimization_thread = threading.Thread(target=periodic_optimization, daemon=True)
    optimization_thread.start()

if __name__ == '__main__':
    logger.info("MiniLoto Prediction API starting (Async Mode)...")
    
    # 🔥 超軽量初期化のみ実行
    if ultra_light_init():
        logger.info("✅ 超軽量初期化成功 - 重い処理は非同期で実行されます")
    else:
        logger.error("❌ 超軽量初期化失敗")
    
    # Flask開発サーバー起動
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False)