import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from "discord-interactions";

/**
 * 環境変数の型定義
 * DISCORD_TOKEN: Discordボットのアクセストークン
 * DISCORD_PUBLIC_KEY: Discordリクエストの署名検証用の公開鍵
 * DIFY_API_KEY: Dify APIへのアクセスキー
 * DIFY_API_ENDPOINT: Dify APIのエンドポイントURL
 */
interface Env {
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  DIFY_API_KEY: string;
  DIFY_API_ENDPOINT: string;
}

interface DifyResponse {
  event: string;
  task_id: string;
  id: string;
  message_id: string;
  conversation_id: string;
  mode: string;
  answer: string;
  metadata: {
    usage: {
      prompt_tokens: number;
      prompt_unit_price: string;
      prompt_price_unit: string;
      prompt_price: string;
      completion_tokens: number;
      completion_unit_price: string;
      completion_price_unit: string;
      completion_price: string;
      total_tokens: number;
      total_price: string;
      currency: string;
      latency: number;
    };
  };
  created_at: number;
}

interface DifyRequestBody {
  inputs: Record<string, unknown>;
  query: string;
  user: string;
  response_mode: "blocking";
  conversation_id: string | null;
  stream: boolean;
}

interface DiscordInteraction {
  type: InteractionType;
  application_id: string;
  token: string;
  member: {
    user: {
      id: string;
    };
  };
  data?: {
    options?: Array<{
      value: string;
    }>;
  };
}

class DifyAPIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "DifyAPIError";
  }
}

const DIFY_TIMEOUT_MS = 30000;
const MAX_MESSAGE_LENGTH = 1900; // Discordの制限を考慮

const ERROR_MESSAGES = {
  THINKING: "考え中...",
  FETCH_FAILED: "申し訳ありません。応答の取得に失敗しました。",
  GENERAL_ERROR: (message: string) => `エラーが発生しました: ${message}`,
} as const;

async function sendFollowupMessage(
  applicationId: string,
  token: string,
  content: string,
  env: Env,
): Promise<void> {
  console.log("Sending followup message:", { applicationId, content });
  const response = await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to send followup message: ${response.status}`);
  }
}

/**
 * メインのリクエストハンドラー
 * 1. Discordからのリクエスト検証
 * 2. インタラクションタイプの判別（PING/コマンド）
 * 3. AIへの問い合わせと応答の送信
 * を行います
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // POSTリクエストのみを受け付け
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      // Discordからのリクエスト署名を検証
      // x-signature-ed25519とx-signature-timestampヘッダーを使用
      const signature = request.headers.get('x-signature-ed25519');
      const timestamp = request.headers.get('x-signature-timestamp');
      const body = await request.clone().text();

      // 必要なヘッダーと環境変数の存在確認
      if (!signature || !timestamp || !env.DISCORD_PUBLIC_KEY) {
        console.error('Missing verification headers or DISCORD_PUBLIC_KEY');
        return new Response('Missing verification headers', { status: 401 });
      }

      // 署名の暗号的検証
      const isValid = await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
      if (!isValid) {
        console.error('Invalid signature');
        return new Response('Invalid signature', { status: 401 });
      }

      const interaction = JSON.parse(body);
      console.log('Received interaction:', interaction);

      // Discordボットの生存確認用PINGへの応答
      if (interaction.type === InteractionType.PING) {
        return new Response(JSON.stringify({
          type: InteractionResponseType.PONG
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // スラッシュコマンドの処理
      if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        // コマンドのメッセージ内容を取得
        const message = interaction.data?.options?.[0]?.value ?? '';
        console.log('Processing command with message:', message);

        try {
          // Dify API設定の検証
          if (!env.DIFY_API_ENDPOINT) {
            throw new Error('DIFY_API_ENDPOINT is not configured');
          }
          if (!env.DIFY_API_KEY) {
            throw new Error('DIFY_API_KEY is not configured');
          }

          console.log('Using Dify endpoint:', env.DIFY_API_ENDPOINT);
          
          // Dify APIリクエストの準備
          // ユーザーIDとメッセージを含むリクエストボディを構築
          const difyRequestBody: DifyRequestBody = {
            inputs: {},
            query: message,
            user: interaction.member.user.id,
            response_mode: "blocking",
            conversation_id: null,
            stream: false
          };

          // Discord「考え中...」の初期レスポンスを送信
          // これによりDiscordの3秒タイムアウトを回避
          const initialResponse = new Response(JSON.stringify({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: ERROR_MESSAGES.THINKING
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });

          // バックグラウンドでDify APIリクエストを処理
          // ctx.waitUntilを使用してレスポンス送信後も処理を継続
          ctx.waitUntil((async () => {
            try {
              // Dify APIへリクエストを送信
              // タイムアウト制限付きで実行
              const difyResponse = await fetch(env.DIFY_API_ENDPOINT, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${env.DIFY_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(difyRequestBody),
                signal: AbortSignal.timeout(DIFY_TIMEOUT_MS)
              });

              // Dify APIレスポンスのエラーチェック
              if (!difyResponse.ok) {
                throw new DifyAPIError(
                  difyResponse.status,
                  `Dify API error: ${difyResponse.status}`
                );
              }

              // AIの応答をDiscordに送信
              // メンション付きで最大文字数制限内に収める
              const answer = await difyResponse.json() as DifyResponse;
              await sendFollowupMessage(
                interaction.application_id,
                interaction.token,
                `<@${interaction.member.user.id}>さん、${answer.answer.slice(0, MAX_MESSAGE_LENGTH)}`,
                env
              );
            } catch (error) {
              // Dify APIエラー時のフォールバック応答
              console.error('Dify API error:', error);
              await sendFollowupMessage(
                interaction.application_id,
                interaction.token,
                ERROR_MESSAGES.FETCH_FAILED,
                env
              );
            }
          })());

          return initialResponse;
        } catch (error) {
          // 初期レスポンス生成時のエラーハンドリング
          console.error('Initial response error:', error);
          return new Response(JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: ERROR_MESSAGES.GENERAL_ERROR(error instanceof Error ? error.message : '不明なエラー')
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // 未知のインタラクションタイプの場合のエラーレスポンス
      return new Response('Unknown interaction type', { status: 400 });
    } catch (error) {
      // 予期せぬエラーのグローバルハンドリング
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
