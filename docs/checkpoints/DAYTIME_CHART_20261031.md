# CHECKPOINT — 受付時間帯のグラフと棒上の数値

2026-10-31 JST。標準の確認時間9:00〜16:30と棒上の数値表示へ改善。

- 開始main：`af19f66e6183973107ddd568e2d618e136c214b1`。開始時open PRなし。
- 実装コミット：`36f429c`、幅調整：`0187f80`。[PR #19](https://github.com/yama-books/entrance-counter/pull/19)、main統合済み。
- アプリ配信対象：`f861215d42dea2b3c96362f9eaa72ee44426a884`。資料を含む最新mainはmainの履歴を参照。
- 標準グラフは9:00〜16:30。15分は30本。15分以上では非ゼロ棒の上へ件数を表示し、桁数に応じた幅を確保。必要な分だけグラフ内を横スクロール。5分は上部固定欄で確認。
- 棒と数値のない場所のタップは無視。固定欄・矢印/Home/Endによる確認は継続する。ゼロ枠はキーボードから確認可能。
- 「終日」へ切替可能。夜間を含むカウント・日合計・CSV/JSON・記録保存は維持。標準表示の最終枠は1時間集計でも16:00〜16:30とし、16:30以降の記録を混ぜない。
- 数字フォント・デザイン・保存形式・集計モデル・GAS送信実装に変更なし。表示用に時間帯を絞るだけで端末の記録を削除・初期化しない。
- 実試験：npm test 8件、npm run check、Edgeブラウザ回帰の終了コード0。30本・棒上の値・隣接数値の非重複、16:30境界と部分時間枠、終日への切替、夜間実タッチカウント・ラベル選択、空白無視、日合計不変、既存機能と画面幅の回帰を確認。
- Jev TypeSafe監査：最終版2件verified、review・矛盾・未根拠0。幅調整前も同結果だったが、幅変更後の実試験を根拠に改めて監査した。gateは使用していない。
- [最終PR CI](https://github.com/yama-books/entrance-counter/actions/runs/41208493165)：model / Chromium / WebKit成功。

- [main CI](https://github.com/yama-books/entrance-counter/actions/runs/41208603140)：成功。
- [Pages配信](https://github.com/yama-books/entrance-counter/actions/runs/41208603133)：build / deploy成功。
- 公開URL：https://yama-books.github.io/entrance-counter/ 。index.html / minimal.css / src/app.jsを読戻し、origin/mainとの一致を確認。
- 公開Edgeの隔離コンテキストで、固定時計10:20の架空入場3件と21:00の1件を入力。標準15分30本と棒上の数字、空白タップ無視、夜間カウント保存、終日の夜間ラベルを実タッチで選択、16:30終端、日合計4件維持、1194/1024/390pxでの配置を確認（終了コード0）。ユーザー端末の実データには触れていない。

未確認：iPad Safari実機での指操作・横スクロール・VoiceOver。実メール到達は今回の対象外（既存の模擬応答回帰のみ）。

次の1操作：iPad Safariで再読込し、「15分ごと」で棒上の件数を確認する。夜間の試し押しは「表示時間：終日」で見る。
