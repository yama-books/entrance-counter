# 確定画像・利用ガイド（2026-10-30）

> **2026-10-31更新：デザイン正本の優先順位**  
> ユーザーがミニマルな8bit受付端末の新デザインを明示採用。次の実装では [UI_MINIMAL_8BIT_20261031.md](./UI_MINIMAL_8BIT_20261031.md) と [新UIの軽量プレビュー](../assets/reference/final_ui_reference_20261031_preview.webp) を優先する。本書の以下の「採用元は元モデル1枚のみ」は2026-10-30当時の記録として保持するもので、最新デザインの採用を妨げない。  
> 画像は640×360の確認用WebPであり、元の1672×941 PNGの完全な複製ではない。入場者（三人ピクトグラム）、時間別集計、担当変更、引継ぎ事項の4箇所をこのデザインへ寄せる。既存透過PNG・動作・設定・受付記録は削除しない。


**採用元はiPad横置きの元モデル1枚のみ**：[`assets/reference/approved_ipad_landscape.png`](../assets/reference/approved_ipad_landscape.png)。その後の色変更・別モデルは採用対象外。

| ID | 画像 | 使いどころ |
|---|---|---|
| ART-01 | `assets/cutouts/ART-01_yaezakura.png` | 画面タイトルの八重桜 |
| ART-02 | `assets/cutouts/ART-02_neko-books.png` | 右上ネコチャン＋本 |
| ART-03 | `assets/cutouts/ART-03_visitors.png` | 入場者カウンター |
| ART-04 | `assets/cutouts/ART-04_akarenga.png` | 赤煉瓦カウンター |
| ART-05 | `assets/cutouts/ART-05_chart.png` | 時間別集計 |
| ART-06 | `assets/cutouts/ART-06_staff.png` | 担当変更 |
| ART-07 | `assets/cutouts/ART-07_memo.png` | 引継ぎ事項 |
| ART-09 | `assets/cutouts/ART-09_yaezakura-small.png` | 小型装飾（任意） |

すべて元モデルから透過PNGとして抽出。画像元の切り出し座標・寸法・各PNGのSHA256は[`assets/cutouts/manifest.json`](../assets/cutouts/manifest.json)を参照。パーツ一覧は[`assets/previews/entrance_counter_cutouts_preview.png`](../assets/previews/entrance_counter_cutouts_preview.png)、一式ZIPは[`assets/packages/entrance_counter_cutouts.zip`](../assets/packages/entrance_counter_cutouts.zip)。

### 注意

- アセットはAI生成モデル画像を切り出したもので、単独原画からの抽出ではない。背景の推定透過処理のため淡色部の輪郭に残留マットがありうる
- 再生成や無断の色替えより、まず既存画像を利用してUIに組み込む
- 滑らかなアンチエイリアス拡大を避け、サイズに応じて`image-rendering: pixelated`を検討。ただし縮小時の視認性も確認
- ART-08（取消矢印）はモデルに独立絵がなく未切り出し。CSS/HTMLで補う
- 背景・ボタン本体・文字・数字・表・グラフはCSS/JSで実装し、モデル全体を背景画像として敷かない
- ファイル名を勝手に変更しない。採用・未採用と配信確認を別々に記録

### 視覚的基準

過度にピンク一色に寄せず、**採用元画像の淡いピンク、アイボリー、余白、端正な配置**を尊重する。八重桜は花弁が多い。ネコチャンは控えめで、来場者に遊び要素を強く感じさせない。アニメーションは受付担当の入力フィードバックに留める。
