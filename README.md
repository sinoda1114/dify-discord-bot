# Dify Discord Bot
Dify APIを使用したDiscord botです。このbotは、DiscordのスラッシュコマンドでDify APIと対話することができます。
バックエンドはCloudflare Workersです。

## 機能
- Discordのスラッシュコマンドに応答
- Dify APIを使用したチャット機能
- エラーハンドリングとログ出力

## セットアップ
### 必要条件
- Node.js (v16以上)
- npm
- Cloudflareアカウント
- Cloudflare Workers
- Discordボットトークン
- Dify APIキー

### Cloudflare Workersのセットアップ
1. Cloudflareアカウントを作成
2. Workersをインストール：
```bash
npm install -g wrangler
wrangler login
```

### インストール
1. リポジトリをクローン：
```bash
git clone https://github.com/sinodamora/dify-discord-bot.git
cd dify-discord-bot
```

2. 依存関係をインストール：
```bash
npm install
```

### Difyの設定
Difyでボットを作成し、APIキーを取得

### Discord Botの設定
1. Discord Developer Portalでアプリケーションを作成
2. Botを有効化し、トークンを取得
3. OAuth2設定でスラッシュコマンド権限を付与

### 環境変数の設定
以下の環境変数をCloudflare Workersのシークレットとして設定：
```bash
npx wrangler secret put DISCORD_TOKEN
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DIFY_API_KEY
```

### デプロイ
```bash
npx wrangler deploy
```

## 開発
ローカルで開発する場合：
```bash
npm run dev
```

## 使用方法
1. Discordサーバーにボットを追加
2. `/chat` コマンドを使用してDifyと対話

## トラブルシューティング
- エラーが発生した場合は、`wrangler tail`でログを確認
- APIキーとエンドポイントが正しく設定されているか確認
- Discord Developer PortalでInteractions Endpoint URLが正しく設定されているか確認

## 謝辞
- [Discord API](https://discord.com/developers/docs/intro)
- [Dify](https://dify.ai/)
- [Cloudflare Workers](https://workers.cloudflare.com/)
