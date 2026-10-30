# 入場人数カウンター

iPad横置きの受付で利用する、入場人数と「赤煉瓦」を個別に記録・集計する軽量Webアプリ。

**状態（2026-10-30 JST）: 画面設計・画像素材保存済み / アプリ本体は未実装 / Pages配信・実機確認は未実施。**

## 正本・実装の入口

- [開発ルール](AGENTS.md)
- [機能・画面仕様](docs/PRODUCT_SPEC.md)
- [切り出し画像の利用ガイド](docs/ASSET_GUIDE.md)
- [ローカル実装担当への引継ぎ](docs/handoff/ENTRANCE_COUNTER_HANDOFF_20261030.md)
- [制作時点の確認記録](docs/checkpoints/ASSETS_READY_20261030.md)

## デザイン・画像

- [採用モデル画像（iPad横置き）](assets/reference/approved_ipad_landscape.png)
- [画像の切り出し一覧](assets/previews/entrance_counter_cutouts_preview.png)
- [透過PNG一覧](assets/cutouts/)
- [切り出し情報（座標・SHA256）](assets/cutouts/manifest.json)
- [素材一式ZIP](assets/packages/entrance_counter_cutouts.zip)

## 動作方針（実装予定）

- 大きな「入場 +1」「赤煉瓦 +1」で別々に加算し、日時・担当を記録。
- 本日合計、30分・1時間単位の集計、履歴、直前の誤入力の取消。
- 担当者変更、引継ぎ事項入力・閲覧。
- ログイン・サーバー不要の単一iPad運用を初期目標とし、端末内に保存。データ持出し用の書出し機能を用意。
- 画像はドット絵のアクセントのみ、文字・ボタン・数値・グラフは動的HTML/CSS/JSで構築。

本リポジトリはPublic。担当者名や実際の来場履歴・引継ぎ事項等の運用データはGitHubにアップロードしない。

> 2026-10-30時点でユーザーはPages設定でGitHub Actionsを選択したと報告。配信ワークフロー追加・Pages成功は別工程。
