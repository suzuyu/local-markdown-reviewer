# Local Markdown Reviewer

Local Markdown Reviewer は、Markdown ファイルをローカル環境や Google Drive 上で閲覧しながら、行・範囲・選択テキストにコメントを付けられる軽量レビュー GUI です。

サーバ、Docker、データベースを用意せずに使えます。コメントは対象フォルダ内の `.local-markdown-reviewer/user-*.json` にユーザ別で保存されるため、Git、Google Drive、NFS、共有ファイルサーバなどで同期して複数人レビューできます。

## Features

- `index.html` をブラウザで開くだけで動くローカル版
- Google Drive 上の Markdown を扱う Google Apps Script 版
- Markdown プレビューと本文編集
- Viewer モードとして使えるコメント非表示オプション
- Git リポジトリを開いた場合の現在 branch 表示
- Mermaid コードフェンスの図表示
- markdown-it による GitHub / VS Code に近い Markdown 表示
- 行番号クリックによる行コメント
- 本文選択による範囲・文字位置付きコメント
- コメントへの返信
- 未対応 / 解決済みの切り替え
- コメント一覧 CSV エクスポート
- コメント位置の再検出
- 対象文言が追えない場合の章見出しへのフォールバック
- 目次、ライト / ダークモード、文字サイズ、行番号表示などの表示設定

## Requirements

ローカル版は File System Access API を使うため、Chromium 系ブラウザを推奨します。

- Google Chrome
- Microsoft Edge
- その他 File System Access API 対応ブラウザ

API が使えない環境では、コメント JSON のダウンロード / 読み込み機能で補助的に利用できます。

## Local Usage

1. このリポジトリを取得するか、GitHub Release からローカル版のファイルを取得します。

```sh
mkdir local-markdown-reviewer
cd local-markdown-reviewer

curl -fL -o index.html \
  https://github.com/suzuyu/local-markdown-reviewer/releases/latest/download/index.html
curl -fL -o app.js \
  https://github.com/suzuyu/local-markdown-reviewer/releases/latest/download/app.js
curl -fL -o styles.css \
  https://github.com/suzuyu/local-markdown-reviewer/releases/latest/download/styles.css
```

2. Mermaid 表示や markdown-it 表示を使う場合は、外部アクセス可能な環境で必要ファイルを取得します。

```sh
curl -fL -o mermaid.min.js \
  https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js
curl -fL -o markdown-it.min.js \
  https://cdn.jsdelivr.net/npm/markdown-it@14/dist/markdown-it.min.js
```

3. Chromium 系ブラウザで `index.html` を開きます。
4. `フォルダを開く` からレビュー対象の Markdown フォルダを選択します。
5. Markdown ファイルを選択してプレビューします。
6. 行番号をクリック、または本文中の対象範囲をドラッグして `コメント追加` を押します。
7. コメントは対象フォルダ内の `.local-markdown-reviewer/user-*.json` に自動保存されます。

次回以降は `前回のフォルダを開く` から再接続できます。選択したフォルダが Git リポジトリの場合、上部に現在の branch が表示されます。

## Viewer Mode

その他メニューの `コメントを非表示` を有効にすると、コメント欄、コメント追加ボタン、本文上のコメント色を隠して単純な Markdown Viewer として使えます。

コメント非表示中も本文エリアは広がりますが、読みやすいように Markdown 本文の幅は抑えています。

## Local Mermaid And Markdown Renderer

ローカル版は外部 CDN にアクセスしません。Mermaid 表示と markdown-it 表示を使う場合は、`index.html` と同じフォルダに以下のファイルを置きます。

`mermaid.min.js` と `markdown-it.min.js` はリポジトリには含めていません。外部アクセス可能な環境で次のコマンドを実行して取得してください。

```sh
curl -L https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js -o mermaid.min.js
curl -L https://cdn.jsdelivr.net/npm/markdown-it@14/dist/markdown-it.min.js -o markdown-it.min.js
```

配置例:

```text
local-markdown-reviewer/
  index.html
  app.js
  styles.css
  mermaid.min.js
  markdown-it.min.js
```

ファイルがない場合、Mermaid はコードブロックとして表示され、Markdown は内蔵の簡易レンダラーで表示されます。

## Google Apps Script Version

`gas/` に Google Drive 上の Markdown をレビューする Web アプリ版があります。

```text
gas/
  Code.gs
  Index.html
  Styles.html
  Client.html
```

### Setup

1. Google Apps Script で新しいプロジェクトを作成します。
2. `gas/` 配下の4ファイルを Apps Script に作成して貼り付けます。
3. Apps Script 上のファイル名は `Code`、`Index`、`Styles`、`Client` にします。
4. V8 ランタイムが有効であることを確認します。
5. Web アプリとしてデプロイします。
6. アプリを開き、`フォルダ選択` からレビュー対象の Google Drive フォルダを選択します。

共有アイテム内のフォルダは、フォルダ選択ダイアログの検索欄から名前で探せます。フォルダ ID を直接指定する場合は、その他メニュー内の入力欄を使います。

GAS 版は対象 Drive フォルダ内に `.local-markdown-reviewer/user-*.json` を作成し、ユーザごとの操作ログとしてコメントを保存します。

GAS 版の Mermaid と markdown-it は CDN を参照します。CDN にアクセスできない環境では、Mermaid ブロックはコードブロックとして表示されます。

更新後は Apps Script の「デプロイを管理」から新しいバージョンを作成してください。

## Multi User Workflow

Google Drive、NFS、共有ファイルサーバ、USB、社内 Git リモートなど、利用できる方法で対象フォルダを同期します。

推奨フロー:

1. レビュー依頼者が Markdown を共有またはコミットする
2. レビュアーが Markdown を開いてコメントを追加する
3. レビュアーが `.local-markdown-reviewer/user-*.json` を共有またはコミットする
4. 作成者がコメントを確認して Markdown を修正する
5. 対応済みコメントを解決済みにして共有またはコミットする

各ユーザは自分の `user-*.json` だけを書き換えます。読み込み時は `.local-markdown-reviewer` 内の全 JSON を操作ログとして合成するため、Google Drive や NFS のような同期環境でも競合を減らせます。

## Comment Position Tracking

コメントには、対象テキスト、前後文脈、行番号、文字位置、近くの見出し情報、上位見出し情報を保存します。

Markdown の編集で行番号がずれた場合は、対象テキストと前後文脈から位置を再検出します。対象文言が見つからない場合は、まず後続文脈、次に先行文脈から位置を推測します。それでも追えない場合は、保存していた見出し情報から章の位置へフォールバックし、コメント一覧では `位置候補` として表示します。対象が見出しそのものだった場合も、見出し名の変更に備えて親見出しや祖先見出しをフォールバック候補にします。

章も見つからない場合は `位置不明` としてコメントを残します。

## Repository Data

コメントデータはレビュー対象フォルダ内に作られます。

```text
.local-markdown-reviewer/
  user-<user-id>.json
```

このフォルダはレビュー結果そのものです。ツール本体のリポジトリでは `.gitignore` に入れていますが、レビュー対象リポジトリでコメントを共有したい場合は、そのリポジトリ側でコミット対象にするかどうかを運用に合わせて決めてください。

## Limitations

- サーバ機能はありません。すべてブラウザまたは Apps Script 内で動作します。
- ローカル版で本文やコメントを直接保存するには File System Access API が必要です。
- 前回フォルダの記憶には IndexedDB を使います。ブラウザや設定によっては再接続時に権限確認が出ます。
- GAS 版では Git コマンドを実行できないため、Git branch などのメタ情報は自動取得できません。
- Google Drive や NFS の同期タイミングによって、他ユーザのコメント反映に遅延が出ることがあります。
- Markdown 表示は GitHub / VS Code に近づけていますが、完全互換ではありません。

## Development

ビルド手順はありません。静的ファイルをそのまま編集します。

```text
index.html
app.js
styles.css
gas/
```

ローカル版は `index.html` をブラウザで開いて確認できます。GAS 版は `gas/` のファイルを Apps Script に反映して確認します。

## License

MIT License. See [LICENSE](LICENSE).

Optional third-party browser files are distributed under their respective licenses.

- Mermaid: https://github.com/mermaid-js/mermaid
- markdown-it: https://github.com/markdown-it/markdown-it
