# EchoMemo 開発ログ

## 2026-02-01 更新内容

### 音声入力挙動の変更
- **目的**: アプリ起動時にWeb Speech APIが自動でレディ状態（「音声入力中...」の表示）になるのを防ぎ、スマートフォンのネイティブキーボード（Google音声入力等）を優先して立ち上げる。
- **変更点**:
    - `app.js` の `openModal` メソッドを修正。
    - `startVoice` フラグが有効な場合でも、ブラウザの音声認識 (`this.startRecording()`) を自動的に呼び出さないように変更。
    - テキストエリアへのフォーカス (`this.memoTextarea.focus()`) は継続することで、OS標準のキーボードが即座に立ち上がるように設定。
- **結果**: 
    - 「アプリ立ち上げ ＞ 自動フォーカス ＞ キーボード（Google音声入力）立ち上げ」というスムーズな流れを実現。
    - ブラウザの音声認識は、必要に応じてマイクボタンをタップすることで手動で開始可能。

### Git操作
- 上記変更を反映し、GitHubリポジトリ (`origin/main`) へプッシュ済み。
- コミットメッセージ: `Stop automatic Web Speech API start on app launch, focus textarea to trigger native keyboard instead`
