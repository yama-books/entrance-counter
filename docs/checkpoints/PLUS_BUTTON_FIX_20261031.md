# CHECKPOINT — ＋ボタン寸法訂正／数字フォント比較

2026-10-31 JST。画面幅によって入場／赤煉瓦の＋ボタンが違う大きさになる不具合を訂正。

- 開始main：`3277883f81ef3cf28bb81fb50fa42ccac82d2894`。開始時open PRなし。
- 修正コミット：`33d096bb12980102645f55a7f7fe89f404f1bdb2`。
- [PR #14](https://github.com/yama-books/entrance-counter/pull/14)、main統合済み。
- アプリ配信対象main：`e529230a5e11307ffb6e17ab261093d4377cc34a`。以後の資料コミットを含む最新mainは履歴を参照。
- 原因：赤煉瓦側のCSS詳細度がレスポンシブ指定に勝ち、高さ・文字サイズ・カード余白が片側にだけ適用されていた。両側のセレクターをそろえた。
- 公開フォント・保存形式・カウント処理・GAS送信実装は変更なし。
- 実検証：npm test 8件、npm run check、Edgeブラウザ回帰が終了コード0。
- 幅1440/1194/1024/768/390pxで両＋ボタンの幅・高さ・縦位置は差0.05px未満、文字サイズは同一。ブラウザのサブピクセル丸め差は許容。
- [PR CI](https://github.com/yama-books/entrance-counter/actions/runs/41145453712)：model / Chromium / WebKit成功。
- [main CI](https://github.com/yama-books/entrance-counter/actions/runs/41145708966)：成功。
- Jev TypeSafe：2件verified、contradicted/unsupportedなし。テスト成功の主張1件はreviewだったため、ホストが実際の出力と終了コード0を確認。寸法確認の主張はauto。
- フォント比較：現在のピクセル数字／Arial Bold／Verdana Bold／Courier New Boldの4案を画像でチャットに提示。架空値128／47、実データなし。比較は同じ112pxの指定。アプリの数字フォントは選定まで維持。
- iPad Safari実機と実メール到達は今回未確認。

[Pages配信](https://github.com/yama-books/entrance-counter/actions/runs/41145708937)はbuild / deploy成功。公開URLは https://yama-books.github.io/entrance-counter/ 。公開CSSがorigin/mainと一致し、隔離Edgeブラウザで上記5幅のボタン寸法と独立タップを確認（終了コード0）。1194pxでは両側285.59375×84px、1024pxでは両側254×78px。実端末の受付データには触れていない。

次の1操作：比較画像のA〜Dから数字フォントの希望を選ぶ。
