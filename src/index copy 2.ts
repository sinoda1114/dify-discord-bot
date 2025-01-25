import {
  InteractionType,
  InteractionResponseType,
  verifyKey,
} from "discord-interactions";

interface Env {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_TOKEN: string;
  DIFY_API_KEY: string;
  DIFY_API_ENDPOINT: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "POST") {
      const signature = request.headers.get("x-signature-ed25519");
      const timestamp = request.headers.get("x-signature-timestamp");
      const body = await request.clone().text();

      if (!signature || !timestamp) {
        console.log("Missing signature headers");
        return new Response("Invalid request", { status: 401 });
      }

      const isValid = await verifyKey(
        body,
        signature,
        timestamp,
        env.DISCORD_PUBLIC_KEY,
      );

      if (!isValid) {
        console.log("Invalid signature");
        return new Response("Invalid request signature", { status: 401 });
      }

      const interaction = JSON.parse(body);

      if (interaction.type === InteractionType.PING) {
        return new Response(
          JSON.stringify({ type: InteractionResponseType.PONG }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        const message = interaction.data.options?.[0]?.value || "";
        const difyResponse = await fetch(env.DIFY_API_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.DIFY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: message,
            user: interaction.member.user.id,
            inputs: {},
            response_mode: "blocking",
          }),
        });

        const answer = await difyResponse.json();
        return new Response(
          JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `<@${interaction.member.user.id}>さん、${answer.answer}`,
            },
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    return new Response("Method not allowed", { status: 405 });
  },
};
