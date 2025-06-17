"""
自動データ取得クラス - Flask対応版
"""

import requests
import pandas as pd
import io
import traceback
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class AutoDataFetcher:
    """ロト7データ自動取得クラス"""
    
    def __init__(self):
        self.csv_url = "https://loto7.thekyo.jp/data/loto7.csv"
        # 実際のCSVカラムに合わせて修正（文字化けを考慮）
        self.main_columns = ['第1数字', '第2数字', '第3数字', '第4数字', '第5数字', '第6数字', '第7数字']
        self.bonus_columns = ['BONUS1', 'BONUS2']
        self.round_column = '開催回'
        self.date_column = '日付'
        self.latest_data = None
        self.latest_round = 0
        
        # データキャッシュ用
        self.cache_manager = None
        
    def set_cache_manager(self, file_manager):
        """ファイル管理器を設定"""
        self.cache_manager = file_manager
        
    def fetch_latest_data(self):
        """最新のロト7データを自動取得"""
        try:
            logger.info("=== 自動データ取得開始 ===")
            logger.info(f"URL: {self.csv_url}")
            
            # CSVデータを取得
            response = requests.get(self.csv_url, timeout=30)
            response.raise_for_status()
            
            logger.info(f"データ取得成功: {len(response.content)} bytes")
            
            # CSVをパース（文字エンコーディングを考慮）
            df = self._parse_csv_content(response.content)
            
            if df is None:
                logger.error("CSVパースに失敗しました")
                # キャッシュからの読み込みを試行
                return self._load_from_cache()
            
            logger.info(f"データ読み込み: {len(df)}件")
            logger.info(f"カラム: {list(df.columns)}")
            
            # データを保存（元のカラム名のまま処理）
            self.latest_data = df.copy()
            
            # 最新回を取得
            if self.round_column in self.latest_data.columns:
                self.latest_round = int(self.latest_data[self.round_column].max())
                logger.info(f"最新開催回: 第{self.latest_round}回")
                
                # 最新データの確認
                latest_entry = self.latest_data[self.latest_data[self.round_column] == self.latest_round].iloc[0]
                logger.info(f"最新回日付: {latest_entry.get(self.date_column, 'N/A')}")
                
                main_nums = [int(latest_entry[col]) for col in self.main_columns if col in latest_entry.index]
                bonus_nums = [int(latest_entry[col]) for col in self.bonus_columns if col in latest_entry.index and pd.notna(latest_entry[col])]
                logger.info(f"最新回当選番号: {main_nums} + ボーナス{bonus_nums}")
            
            # キャッシュに保存
            if self.cache_manager:
                self.cache_manager.save_data_cache(self.latest_data)
            
            logger.info("自動データ取得完了")
            return True
            
        except requests.exceptions.RequestException as e:
            logger.error(f"ネットワークエラー: {e}")
            # キャッシュからの読み込みを試行
            return self._load_from_cache()
        except Exception as e:
            logger.error(f"データ取得エラー: {e}")
            logger.error(f"詳細: {traceback.format_exc()}")
            # キャッシュからの読み込みを試行
            return self._load_from_cache()
    
    def _parse_csv_content(self, content):
        """CSVコンテンツをパース（複数エンコーディング対応）"""
        encodings = ['utf-8', 'shift-jis', 'cp932', 'iso-8859-1']
        
        for encoding in encodings:
            try:
                csv_content = content.decode(encoding)
                df = pd.read_csv(io.StringIO(csv_content))
                
                # 基本的な検証
                if len(df) > 0 and len(df.columns) >= 7:
                    logger.info(f"CSV解析成功（エンコーディング: {encoding}）")
                    return df
                    
            except Exception as e:
                logger.debug(f"エンコーディング {encoding} でのパース失敗: {e}")
                continue
        
        logger.error("全てのエンコーディングでCSVパースに失敗")
        return None
    
    def _load_from_cache(self):
        """キャッシュからデータを読み込み"""
        if not self.cache_manager:
            return False
            
        try:
            cached_data = self.cache_manager.load_data_cache()
            if cached_data is not None and len(cached_data) > 0:
                self.latest_data = cached_data
                
                if self.round_column in self.latest_data.columns:
                    self.latest_round = int(self.latest_data[self.round_column].max())
                
                logger.info(f"キャッシュからデータを読み込み: {len(self.latest_data)}件")
                logger.info(f"最新開催回: 第{self.latest_round}回（キャッシュ）")
                return True
            else:
                logger.warning("キャッシュデータが無効です")
                return False
                
        except Exception as e:
            logger.error(f"キャッシュ読み込みエラー: {e}")
            return False
    
    def get_next_round_info(self):
        """次回開催回の情報を取得"""
        if self.latest_round == 0:
            return None
            
        next_round = self.latest_round + 1
        current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        return {
            'next_round': next_round,
            'current_date': current_date,
            'latest_round': self.latest_round,
            'prediction_target': f"第{next_round}回"
        }
    
    def get_data_for_training(self):
        """学習用データを返す"""
        if self.latest_data is None:
            return None
        return self.latest_data
    
    def validate_data_integrity(self):
        """データの整合性をチェック"""
        if self.latest_data is None:
            return False, "データが読み込まれていません"
        
        try:
            # 必要なカラムの存在確認
            required_columns = [self.round_column] + self.main_columns
            missing_columns = [col for col in required_columns if col not in self.latest_data.columns]
            
            if missing_columns:
                return False, f"必要なカラムが不足: {missing_columns}"
            
            # データの基本検証
            if len(self.latest_data) == 0:
                return False, "データが空です"
            
            # 数値データの検証
            for col in self.main_columns:
                if col in self.latest_data.columns:
                    # 数値範囲チェック（1-37）
                    invalid_numbers = self.latest_data[
                        (self.latest_data[col] < 1) | (self.latest_data[col] > 37)
                    ]
                    if len(invalid_numbers) > 0:
                        return False, f"{col}に無効な数値があります（1-37の範囲外）"
            
            # 開催回の連続性チェック
            rounds = sorted(self.latest_data[self.round_column].unique())
            if len(rounds) > 1:
                gaps = []
                for i in range(1, len(rounds)):
                    if rounds[i] - rounds[i-1] > 1:
                        gaps.append((rounds[i-1], rounds[i]))
                
                if gaps:
                    logger.warning(f"開催回に欠損があります: {gaps}")
            
            return True, f"データ検証成功: {len(self.latest_data)}件、第{self.latest_round}回まで"
            
        except Exception as e:
            return False, f"データ検証エラー: {str(e)}"
    
    def get_data_summary(self):
        """データサマリーを取得"""
        if self.latest_data is None:
            return None
        
        try:
            summary = {
                'total_records': len(self.latest_data),
                'latest_round': self.latest_round,
                'earliest_round': int(self.latest_data[self.round_column].min()) if self.round_column in self.latest_data.columns else None,
                'columns': list(self.latest_data.columns),
                'date_range': {
                    'start': None,
                    'end': None
                }
            }
            
            # 日付範囲の取得
            if self.date_column in self.latest_data.columns:
                dates = pd.to_datetime(self.latest_data[self.date_column], errors='coerce')
                valid_dates = dates.dropna()
                if len(valid_dates) > 0:
                    summary['date_range']['start'] = valid_dates.min().isoformat()
                    summary['date_range']['end'] = valid_dates.max().isoformat()
            
            # 数値統計
            number_stats = {}
            for col in self.main_columns:
                if col in self.latest_data.columns:
                    numbers = self.latest_data[col].dropna()
                    if len(numbers) > 0:
                        number_stats[col] = {
                            'min': int(numbers.min()),
                            'max': int(numbers.max()),
                            'mean': float(numbers.mean()),
                            'count': len(numbers)
                        }
            
            summary['number_statistics'] = number_stats
            
            return summary
            
        except Exception as e:
            logger.error(f"データサマリー生成エラー: {e}")
            return None
    
    def get_recent_results(self, count=5):
        """最近の抽選結果を取得"""
        if self.latest_data is None or len(self.latest_data) == 0:
            return []
        
        try:
            # 最新のcount件を取得
            recent_data = self.latest_data.nlargest(count, self.round_column)
            
            results = []
            for _, row in recent_data.iterrows():
                round_num = int(row[self.round_column])
                
                # メイン数字
                main_numbers = []
                for col in self.main_columns:
                    if col in row.index and pd.notna(row[col]):
                        main_numbers.append(int(row[col]))
                
                # ボーナス数字
                bonus_numbers = []
                for col in self.bonus_columns:
                    if col in row.index and pd.notna(row[col]):
                        bonus_numbers.append(int(row[col]))
                
                # 日付
                date_str = row.get(self.date_column, '') if self.date_column in row.index else ''
                
                if len(main_numbers) == 7:  # 有効なデータのみ
                    results.append({
                        'round': round_num,
                        'date': date_str,
                        'main_numbers': sorted(main_numbers),
                        'bonus_numbers': sorted(bonus_numbers)
                    })
            
            return sorted(results, key=lambda x: x['round'], reverse=True)
            
        except Exception as e:
            logger.error(f"最近の結果取得エラー: {e}")
            return []
