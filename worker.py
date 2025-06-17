#!/usr/bin/env python3
"""
Celeryワーカー起動スクリプト
Render.com対応版（持続動作修正版）
"""

import os
import sys
import logging
import signal
import time
from celery_app import celery_app

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# グローバル変数で実行状態を管理
worker_running = True

def signal_handler(signum, frame):
    """シグナルハンドラー - 優雅な終了"""
    global worker_running
    logger.info(f"🛑 シグナル {signum} を受信しました。ワーカーを停止します...")
    worker_running = False

def setup_signal_handlers():
    """シグナルハンドラーの設定"""
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    if hasattr(signal, 'SIGHUP'):
        signal.signal(signal.SIGHUP, signal_handler)

def test_celery_connection():
    """Celery接続テスト"""
    try:
        logger.info("🔍 Celery接続テスト中...")
        
        # ブローカー接続テスト
        inspect = celery_app.control.inspect()
        stats = inspect.stats()
        
        if stats is None:
            logger.warning("⚠️ 他のワーカーが見つかりませんが、続行します")
        else:
            logger.info(f"✅ {len(stats)} 個のワーカーが検出されました")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Celery接続テストエラー: {e}")
        return False

def start_worker():
    """Celeryワーカーを起動"""
    try:
        logger.info("🚀 Celeryワーカーを開始します...")
        
        # 環境変数の確認
        redis_url = os.environ.get('CELERY_BROKER_URL')
        if not redis_url:
            logger.error("❌ CELERY_BROKER_URL環境変数が設定されていません")
            return False
        
        logger.info(f"📡 Redis接続先: {redis_url}")
        
        # シグナルハンドラー設定
        setup_signal_handlers()
        
        # 接続テスト
        if not test_celery_connection():
            logger.error("❌ Celery接続テストに失敗しました")
            return False
        
        # ワーカー設定（修正版）
        worker_args = [
            'worker',
            '--loglevel=info',
            '--concurrency=1',
            '--pool=solo',  # Render.com無料プランに適した設定
            '--queues=training,prediction,validation,celery',
            '--without-heartbeat',  # ハートビート無効化（メモリ節約）
            '--without-mingle',     # Mingle無効化（起動高速化）
            '--without-gossip',     # Gossip無効化（メモリ節約）
            '--max-tasks-per-child=10',  # メモリリーク防止
            '--max-memory-per-child=400000',  # 400MB制限
        ]
        
        # 追加環境変数設定
        os.environ.setdefault('CELERY_WORKER_PREFETCH_MULTIPLIER', '1')
        os.environ.setdefault('CELERY_TASK_ACKS_LATE', 'true')
        
        logger.info("✅ Celeryワーカーが開始されました")
        logger.info(f"🔧 引数: {' '.join(worker_args)}")
        
        # ワーカー開始（修正版 - 例外処理強化）
        try:
            celery_app.worker_main(worker_args)
        except SystemExit as e:
            logger.info(f"🔄 ワーカーがSystemExitで終了: {e}")
            # SystemExitは正常終了の場合があるので、再起動を試行
            return True
        except KeyboardInterrupt:
            logger.info("🛑 KeyboardInterruptによりワーカーが停止されました")
            return True
        except Exception as e:
            logger.error(f"❌ ワーカー実行エラー: {e}")
            logger.error(f"エラー詳細: {type(e).__name__}: {str(e)}")
            return False
        
        return True
        
    except Exception as e:
        logger.error(f"❌ ワーカー開始エラー: {e}")
        return False

def main_with_restart():
    """メイン実行（再起動対応）"""
    max_restarts = 5
    restart_count = 0
    
    while restart_count < max_restarts and worker_running:
        try:
            logger.info(f"🔄 ワーカー起動試行 {restart_count + 1}/{max_restarts}")
            
            success = start_worker()
            
            if success:
                logger.info("✅ ワーカーが正常に実行されました")
                break
            else:
                restart_count += 1
                if restart_count < max_restarts:
                    wait_time = min(30, 5 * restart_count)  # 5, 10, 15, 20, 30秒
                    logger.warning(f"⚠️ {wait_time}秒後に再起動を試行します...")
                    time.sleep(wait_time)
                
        except Exception as e:
            logger.error(f"❌ メイン実行エラー: {e}")
            restart_count += 1
            if restart_count < max_restarts:
                time.sleep(10)
    
    if restart_count >= max_restarts:
        logger.error(f"❌ 最大再起動回数({max_restarts})に達しました。ワーカーを終了します。")
        sys.exit(1)
    
    logger.info("🏁 ワーカーが正常に終了しました")

def health_check():
    """ヘルスチェック機能"""
    try:
        # 簡単な接続確認
        inspect = celery_app.control.inspect()
        stats = inspect.stats()
        logger.info("💚 ヘルスチェック: OK")
        return True
    except Exception as e:
        logger.error(f"❤️‍🩹 ヘルスチェック: NG - {e}")
        return False

if __name__ == '__main__':
    try:
        logger.info("=" * 50)
        logger.info("🎯 MiniLoto Celeryワーカー起動中...")
        logger.info("=" * 50)
        
        # 初期ヘルスチェック
        if not health_check():
            logger.warning("⚠️ 初期ヘルスチェックに失敗しましたが、続行します")
        
        # メイン実行
        main_with_restart()
        
    except KeyboardInterrupt:
        logger.info("🛑 ユーザーによりワーカーが停止されました")
    except Exception as e:
        logger.error(f"❌ 致命的エラー: {e}")
        sys.exit(1)
    finally:
        logger.info("🏁 Celeryワーカーが終了しました")