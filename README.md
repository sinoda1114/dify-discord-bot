# Dify Discord Bot

Dify APIを使用したDiscord botです。このbotは、DiscordのスラッシュコマンドでDify APIと対話することができます。

## 機能

- Discordのスラッシュコマンドに応答
- Dify APIを使用したチャット機能
- エラーハンドリングとログ出力

## セットアップ

### 必要条件

- Node.js (v16以上)
- npm
- Cloudflareアカウント
- Discordボットトークン
- Dify APIキー

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

- エラーが発生した場合は、ログを確認してください
- APIキーとエンドポイントが正しく設定されていることを確認してください


## 謝辞

- [Discord API](https://discord.com/developers/docs/intro)
- [Dify](https://dify.ai/)
- [Cloudflare Workers](https://workers.cloudflare.com/)