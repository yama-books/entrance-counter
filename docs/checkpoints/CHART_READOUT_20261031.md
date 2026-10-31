# CHECKPOINT — 時間別グラフの数値確認

2026-10-31 JST。ユーザー承認の推奨案を実装。現在のデザインと数字フォントを維持する。

- 開始main：`c96048a`。開始時open PRなし。
- 実装コミット：`90f87d0`。[PR #17](https://github.com/yama-books/entrance-counter/pull/17)、main統合済み。
- 配信対象アプリHEAD：`a1d9b0dcae50fcb0843d763c02eb9c90718c7463`。資料コミットを含む最新mainはmainの履歴を参照。
- 固定の数値欄に選択時間帯と人数／冊数を表示。棒をタップ、左右スライド、矢印/Home/Endで選択できる。選択棒を濃くし、0件の時間帯にも位置マーカーを表示。
- 「5分ごと／15分ごと／30分ごと／1時間ごと」の表記。単位や種類の切替時は選択時刻を維持。初期表示は最新の非ゼロ枠、空の日は現在時刻の枠。日付変更時は選択をリセット。
- 棒を等幅の選択領域として配置し、縦スクロールを許可。グラフと時間軸がパネル内に収まるよう高さを調整。保存形式・集計モデル・GASの内部実装は変更なし。選択は記録として保存しない。
- ローカル：npm test（8件）、npm run check、Edgeブラウザ回帰すべて終了コード0。
- 検証：固定欄の時間と値、15/30分切替と時間維持、種類切替、ドラッグと最終枠、キーボード境界、実タッチの0件枠選択、カウントを増やさないこと。既存回帰と5画面幅の配置・同寸＋ボタンも成功。
- [PR CI](https://github.com/yama-books/entrance-counter/actions/runs/41202597904)：model / Chromium / WebKit成功。
- Jev TypeSafe：2件verified、矛盾・未根拠なし。実試験成功の主張1件reviewはホストが実出力と終了コード0を確認。選択操作の主張はauto。既存設定のMCPを利用し、provider変更なし。

- [main CI](https://github.com/yama-books/entrance-counter/actions/runs/41202708000)：成功。
- [Pages配信](https://github.com/yama-books/entrance-counter/actions/runs/41202707917)：build / deploy成功。
- 公開URL：https://yama-books.github.io/entrance-counter/ 。index.html / minimal.css / src/app.jsがorigin/mainと一致。
- 公開Edgeの隔離コンテキストで10/31 10:20 JSTに時計を固定し、架空の入場3件・赤煉瓦2件を入力。15分の10:15〜10:30、30分の10:00〜10:30、種類切替と数値、タッチによる0件枠、24:00の終端、配置とカウント非増加を確認（終了コード0）。ユーザー端末のデータには触れていない。

未確認：iPad Safari実機の指操作・VoiceOver。実メール到達は今回の検証対象外（模擬応答の既存回帰のみ）。

次の1操作：iPad Safariで公開URLを再読込し、「15分ごと」を選んでグラフを左右に滑らせ、上部の時間帯と数値を確認する。
