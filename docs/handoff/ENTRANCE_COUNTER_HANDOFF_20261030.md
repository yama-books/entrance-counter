# 入場人数カウンター｜ローカル実装セッションへのHANDOFF

- 引継ぎ日：2026-10-30 JST
- APP-ID：**APP-026**（[共通台帳](https://github.com/moyashimisosoup/session-deck/blob/main/docs/APP_PORTFOLIO.md)に2026-10-30登録・読戻し確認）
- ローカル実装の作業ID案：**APP-026/IMPLEMENT-01**（新セッション開始時に採用・登録）
- 素材保存Commit：[`ad16e174`](https://github.com/yama-books/entrance-counter/commit/ad16e174577a4ddbc44a26a8d199af584c1c0ea9)（画像・仕様19ファイルのSHA照合済み）
- App Factory：[Issue #17](https://github.com/moyashimisosoup/app-factory/issues/17)を「本人がPublic Repo作成済み」に訂正済み（再生成禁止）
- 状態：**ASSET_READY / IMPLEMENTATION_NOT_STARTED / HANDOFF_READY**
- Repo（Public）：https://github.com/yama-books/entrance-counter
- 基準ブランチ：`main`。作業開始時に必ず最新HEAD・PR・Actionsを取得すること（引継ぎの基点HEADは初期コミット`7aa4ee7c09d9fae4a9a51a708afa0591c2b97af0`、素材保存コミットで更新される）。
- 対象作業：iPad横置き受付Webアプリの初期実装、検証、Pages配信。ユーザーは実装を**ローカルセッションに依頼**する。ここでは実装していない。

## 最初に読むファイル

1. `AGENTS.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/ASSET_GUIDE.md`
4. `assets/reference/approved_ipad_landscape.png`
5. `assets/previews/entrance_counter_cutouts_preview.png`
6. `assets/cutouts/manifest.json`

## 完了済み・保存対象

- 採用モデル：iPad横置き、1672×941、見出し「本日の図書館入場者数」、多弁の八重桜、右上ネコチャン、左2カウンター、右側集計・履歴、下段操作
- 透過PNG：ART-01/02/03/04/05/06/07/09 の計8点
- 元モデル、素材プレビュー、manifest・説明、ZIP をリポジトリに格納する素材保存工程
- 配色は**元モデルを固定**。色変更案・後続生成画像を上書き採用しない
- デザインの概念説明のみでなく実装可能な機能仕様を`docs/PRODUCT_SPEC.md`に保存

## 今回未実施（完成とは呼ばない）

- `index.html`・動作するカウンター
- 時刻・スタッフ・引継ぎの記録/集計/エクスポート
- 実データ保存・Undo・画面遷移・アニメーション
- GitHub Actions Pages deploy workflow、Pages公開・実機ブラウザ確認
- iPad横置きSafari検収

ユーザーはSettings → Pagesで「GitHub Actions」を選んだと報告したが、ワークフローの実体・配信成功は未検証。

## 実装担当への次の操作

1. 最新HEADと設計書/画像8点を照合。既存作業・PR・CIを上書きしない
2. 依存の少ないHTML/CSS/JSで、まず2ボタン→イベント記録→画面更新→履歴と集計の**縦通し**を実装
3. 担当交代とメモ、誤操作取消、CSV/JSON入出力、保存復旧を追加
4. 採用モデルに近いiPad横置きUIを実装。イラストは既存PNG、モデル画像を画面そのものとして貼らない
5. 押下アニメーションを短く明瞭に。連打・reduced-motionと来場者からの目立ちにくさを検証
6. 確認用テストを設けてPR・CIとmain統合後の読戻し
7. Pages GitHub Actions配信を構成し、配信結果と公開URLの動作を確認
8. iPad実機で操作・再読込・データ出力・担当変更を受入検証

## 非機能・運用の注意

- 公開Repo。個人名・実カウント・引継ぎ実文・学校内情報はコミット/テスト/Actionsに載せない
- アカウント不要、端末ローカル保存が初期前提。長時間運用中のSafariデータ喪失に備えエクスポート必須
- 「赤煉瓦」の用途は**アプリ画面に説明しない**
- ソース保存、CI成功、Pages配信、iPad実機確認は独立に報告
- 実装開始まで画像制作・再トリミングを繰り返さない

## 完遂判定

`docs/PRODUCT_SPEC.md`の受入条件が通り、最新main・CI、Pages配信、iPad Safari実機の検証根拠を示せれば初期実装完成。未確認があれば状態を残して次セッションへ明確に引継ぐ。
