#!/usr/bin/env python3
"""
Celeryワーカー起動スクリプト
Render.com対応版（修正版）
"""

import os
import sys
import logging
from celery_app import celery_app

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def start_worker():
    """Celeryワーカーを起動"""
    try:
        logger.info("🚀 Celeryワーカーを開始します...")
        
        # 環境変数の確認
        redis_url = os.environ.get('CELERY_BROKER_URL')
        if not redis_url:
            logger.error("❌ CELERY_BROKER_URL環境変数が設定されていません")
            sys.exit(1)
        
        logger.info(f"📡 Redis接続先: {redis_url}")
        
        # ワーカー設定（修正版）
        # コマンドライン引数として有効なもののみ使用
        worker_args = [
            'worker',
            '--loglevel=info',
            '--concurrency=1',
            '--pool=solo',  # Render.com無料プランに適したプール
            '--queues=training,prediction,validation,celery',
            '--without-heartbeat',  # ハートビート無効化（メモリ節約）
            '--without-mingle',     # Mingle無効化（起動高速化）
            '--without-gossip',     # Gossip無効化（メモリ節約）
        ]
        
        # メモリ制限は環境変数で設定
        os.environ.setdefault('CELERY_WORKER_MAX_TASKS_PER_CHILD', '10')
        os.environ.setdefault('CELERY_WORKER_MAX_MEMORY_PER_CHILD', '400000')
        
        # ワーカー開始
        logger.info("✅ Celeryワーカーが開始されました")
        logger.info(f"🔧 引数: {' '.join(worker_args)}")
        
        celery_app.worker_main(worker_args)
        
    except KeyboardInterrupt:
        logger.info("🛑 ワーカーが停止されました")
    except Exception as e:
        logger.error(f"❌ ワーカー開始エラー: {e}")
        sys.exit(1)

if __name__ == '__main__':
    start_worker()