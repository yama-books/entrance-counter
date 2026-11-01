# 入場人数カウンター

iPad横置きの受付で利用する、入場人数と「赤煉瓦」を個別に記録・集計する軽量Webアプリ。

**状態（2026-11-01 JST）: 担当別予測・2日間の確定/解除・通算表示を実装。配信状況は最新CHECKPOINTを参照 / iPad Safari実機検収は未実施。**

- [アプリを開く](https://yama-books.github.io/entrance-counter/)
- [最新公開記録：全日程終了と一枚サマリー](docs/checkpoints/FINAL_SUMMARY_20261101.md)
- [担当別予測・2日間の確定/解除・通算表示](docs/checkpoints/EVENT_FEATURES_20261101.md)
- [9:00〜16:30のグラフと棒上の数値](docs/checkpoints/DAYTIME_CHART_20261031.md)
- [集計グラフの時間帯・数値表示](docs/checkpoints/CHART_READOUT_20261031.md)
- [確定ミニマル8bit UIの公開記録](docs/checkpoints/UI_REFINE_01_20261031.md)
- [前回公開記録：配色・画像の色調整・予定表示](docs/checkpoints/RELEASE_6_20261030.md)
- [実装CHECKPOINT](docs/checkpoints/IMPLEMENT_01_20261030.md)
- [検証方法・保存仕様・実機での確認事項](docs/VALIDATION.md)

## 正本・実装の入口

- [開発ルール](AGENTS.md)
- [機能・画面仕様](docs/PRODUCT_SPEC.md)
- [切り出し画像の利用ガイド](docs/ASSET_GUIDE.md)
- [ローカル実装担当への引継ぎ](docs/handoff/ENTRANCE_COUNTER_HANDOFF_20261030.md)
- [制作時点の確認記録](docs/checkpoints/ASSETS_READY_20261030.md)

## デザイン・画像

- [最新確定：ミニマル8bitのデザイン仕様と参照プレビュー](docs/UI_MINIMAL_8BIT_20261031.md)（画面の実装は別工程）

- [採用モデル画像（iPad横置き）](assets/reference/approved_ipad_landscape.png)
- [画像の切り出し一覧](assets/previews/entrance_counter_cutouts_preview.png)
- [透過PNG一覧](assets/cutouts/)
- [切り出し情報（座標・SHA256）](assets/cutouts/manifest.json)
- [素材一式ZIP](assets/packages/entrance_counter_cutouts.zip)

## 動作

- 大きな「入場 +1」「赤煉瓦 +1」で別々に加算し、日時・担当を記録。
- 本日合計、5分・15分・30分・1時間単位の集計、履歴、直前の誤入力の取消。
- 上部の「入場者数予測」で本日/2日間の見込みと担当者ごとの予測を記録。担当者名は転記・編集可能。保存後に前の人の予測を表示。
- 下部の「終了・結果」で各日を確定/解除。「前日の記録」で1日目を閲覧。2日目はカウンター下の累計と「2日通算」の横並びグラフも利用可能。
- 「終了・結果」→「全日程終了・サマリー」で、日別結果・2日合計・入場/赤煉瓦それぞれのグラフを一枚に表示。印刷用の配置と受付画面へ戻る操作も利用可能。
- 担当者変更、引継ぎ事項入力・閲覧。
- ログイン・サーバー不要の単一iPad運用を初期目標とし、端末内に保存。データ持出し用の書出し機能を用意。
- 集計単位は5分・15分・30分・1時間。引継ぎ本文を記録一覧で強調し、「シフト表」から画像を端末内に保存・閲覧できる。
- 「山本を呼ぶ」から要件を入力すると、Google Apps Script経由でメール送信する（宛先はGAS側のみ、設定は[CALL_SETUP](docs/CALL_SETUP.md)）。
- 画像はドット絵のアクセントのみ、文字・ボタン・数値・グラフは動的HTML/CSS/JSで構築。

本リポジトリはPublic。担当者名や実際の来場履歴・引継ぎ事項等の運用データはGitHubにアップロードしない。

## 開発

Node.js 24で `npm ci`、`npm test`、`npm run check`。ブラウザ試験は `docs/VALIDATION.md` を参照。フレームワーク・ビルド工程なしのHTML/CSS/JavaScriptで動作し、記録は端末のIndexedDBに保存する。担当者は初期状態で「未設定」。定期的にJSONを書き出して保管する。
