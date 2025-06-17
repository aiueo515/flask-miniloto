#!/usr/bin/env python3
"""
PWAアイコン生成スクリプト
ロト7予測アプリ用のアイコンを自動生成
"""

import os
from PIL import Image, ImageDraw, ImageFont
import argparse

def create_loto7_icon(size, output_path):
    """
    ロト7予測アプリのアイコンを生成
    
    Args:
        size (int): アイコンサイズ
        output_path (str): 出力パス
    """
    # 背景色（グラデーション風）
    bg_color = '#1890ff'
    
    # 新しい画像を作成
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 背景の円を描画
    margin = size // 10
    draw.ellipse([margin, margin, size - margin, size - margin], 
                 fill=bg_color, outline=None)
    
    # テキストを描画
    try:
        # フォントサイズを計算
        font_size = size // 3
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", font_size)
        except:
            font = ImageFont.load_default()
    
    # "7" を描画
    text = "7"
    text_bbox = draw.textbbox((0, 0), text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    
    text_x = (size - text_width) // 2
    text_y = (size - text_height) // 2 - size // 20
    
    draw.text((text_x, text_y), text, fill='white', font=font)
    
    # 下部に小さく "LOTO" を描画
    try:
        small_font = ImageFont.truetype("arial.ttf", size // 8)
    except:
        try:
            small_font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", size // 8)
        except:
            small_font = ImageFont.load_default()
    
    small_text = "LOTO"
    small_bbox = draw.textbbox((0, 0), small_text, font=small_font)
    small_width = small_bbox[2] - small_bbox[0]
    
    small_x = (size - small_width) // 2
    small_y = size - size // 4
    
    draw.text((small_x, small_y), small_text, fill='white', font=small_font)
    
    # 保存
    img.save(output_path, 'PNG')
    print(f"アイコン生成完了: {output_path} ({size}x{size})")

def create_shortcut_icon(size, output_path, icon_type):
    """
    ショートカット用アイコンを生成
    
    Args:
        size (int): アイコンサイズ
        output_path (str): 出力パス
        icon_type (str): アイコンタイプ (predict, history, analysis)
    """
    colors = {
        'predict': '#1890ff',
        'history': '#52c41a', 
        'analysis': '#722ed1'
    }
    
    symbols = {
        'predict': '🎯',
        'history': '📊',
        'analysis': '🔍'
    }
    
    # 新しい画像を作成
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 背景の円を描画
    margin = size // 10
    color = colors.get(icon_type, '#1890ff')
    draw.ellipse([margin, margin, size - margin, size - margin], 
                 fill=color, outline=None)
    
    # シンボルを描画
    symbol = symbols.get(icon_type, '🎯')
    try:
        font_size = size // 2
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    # テキストを中央に配置
    text_bbox = draw.textbbox((0, 0), symbol, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    
    text_x = (size - text_width) // 2
    text_y = (size - text_height) // 2
    
    draw.text((text_x, text_y), symbol, fill='white', font=font)
    
    # 保存
    img.save(output_path, 'PNG')
    print(f"ショートカットアイコン生成完了: {output_path} ({size}x{size})")

def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(description='PWAアイコン生成')
    parser.add_argument('--output-dir', default='./static/icons', 
                       help='出力ディレクトリ')
    
    args = parser.parse_args()
    
    # 出力ディレクトリを作成
    os.makedirs(args.output_dir, exist_ok=True)
    
    # 必要なアイコンサイズ
    icon_sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    
    # メインアイコンを生成
    for size in icon_sizes:
        output_path = os.path.join(args.output_dir, f'icon-{size}x{size}.png')
        create_loto7_icon(size, output_path)
    
    # ショートカットアイコンを生成
    shortcut_types = ['predict', 'history', 'analysis']
    for shortcut_type in shortcut_types:
        output_path = os.path.join(args.output_dir, f'shortcut-{shortcut_type}.png')
        create_shortcut_icon(96, output_path, shortcut_type)
    
    print("\n✅ 全てのアイコン生成が完了しました！")
    print(f"出力先: {args.output_dir}")
    
    # ファビコンも生成
    favicon_path = os.path.join(args.output_dir, 'favicon.ico')
    create_loto7_icon(32, favicon_path.replace('.ico', '.png'))
    
    # PNGをICOに変換（PILでサポートされている場合）
    try:
        favicon_img = Image.open(favicon_path.replace('.ico', '.png'))
        favicon_img.save(favicon_path, format='ICO', sizes=[(32, 32)])
        print(f"ファビコン生成完了: {favicon_path}")
    except Exception as e:
        print(f"ファビコン生成スキップ: {e}")

if __name__ == '__main__':
    main()
