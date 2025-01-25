import { InteractionResponseType, InteractionType, verifyKey } from 'discord-interactions';

interface Env {
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  DIFY_API_KEY: string;
  DIFY_API_ENDPOINT: string;
}

interface DifyResponse {
  answer: string;
  // 他のDify APIレスポンスのプロパティもここに定義
}

interface DiscordInteraction {
  type: InteractionType;
  data?: {
    options?: Array<{
      value: string;
    }>;
  };
  member: {
    user: {
      id: string;
    };
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      const signature = request.headers.get('X-Signature-Ed25519');
      const timestamp = request.headers.get('X-Signature-Timestamp');
      const body = await request.clone().text();

      if (!signature || !timestamp) {
        return new Response('Missing signature', { status: 401 });
      }

      const isValid = await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
      if (!isValid) {
        return new Response('Invalid signature', { status: 401 });
      }

      const interaction = JSON.parse(body) as DiscordInteraction;

      if (interaction.type === InteractionType.PING) {
        return new Response(JSON.stringify({
          type: InteractionResponseType.PONG
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        console.log('Command received:', interaction);
        const { data, member } = interaction;
        const messageContent = data.options?.[0]?.value || '';

        try {
          const difyResponse = await fetch(env.DIFY_API_ENDPOINT, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.DIFY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: messageContent,
              user: member.user.id,
              inputs: {},
              response_mode: 'blocking'
            })
          });

          if (!difyResponse.ok) {
            throw new Error(`Dify API returned ${difyResponse.status}: ${await difyResponse.text()}`);
          }

          const answer = await difyResponse.json() as DifyResponse;
          console.log('Dify response:', answer);

          return new Response(JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `<@${member.user.id}>さん、${answer.answer.slice(0, 1900)}`
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('Error:', error);
          const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
          return new Response(JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `エラーが発生しました: ${errorMessage}`
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response('Unknown type', { status: 400 });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }
};