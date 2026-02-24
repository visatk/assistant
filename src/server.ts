import { routeAgentRequest } from "agents";
import { AIChatAgent } from "@cloudflare/ai-chat";
import { withDurableChat } from "@cloudflare/ai-chat/experimental/forever";
import {
  streamText,
  convertToModelMessages,
  pruneMessages,
  tool,
  stepCountIs
} from "ai";
import { createWorkersAI } from "@ai-sdk/cloudflare";
import { z } from "zod";

const DurableChatAgent = withDurableChat(AIChatAgent);

export class ForeverChatAgent extends DurableChatAgent<Env> {
  public maxPersistedMessages = 200;

  async onChatMessage(): Promise<Response> {
    const workersai = createWorkersAI({ binding: this.env.AI });

    const result = streamText({
      model: workersai("@cf/meta/llama-3.1-8b-instruct"),
      system:
        "You are a helpful assistant running as a durable agent. " +
        "Your streaming connection is kept alive via keepAlive(), " +
        "so even long responses won't be interrupted by idle timeouts. " +
        "You can check the weather and perform calculations. " +
        "For calculations with large numbers (over 1000), you need user approval first.",
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages",
        reasoning: "before-last-message"
      }),
      tools: {
        getWeather: tool({
          description: "Get the current weather for a city",
          inputSchema: z.object({
            city: z.string().describe("City name")
          }),
          execute: async ({ city }: { city: string }) => {
            const conditions = ["sunny", "cloudy", "rainy", "snowy"];
            const temp = Math.floor(Math.random() * 30) + 5;
            return {
              city,
              temperature: temp,
              condition: conditions[Math.floor(Math.random() * conditions.length)],
              unit: "celsius"
            };
          }
        }),

        getUserTimezone: tool({
          description:
            "Get the user's timezone from their browser. Use this when you need to know the user's local time.",
          inputSchema: z.object({})
        }),

        calculate: tool({
          description:
            "Perform a math calculation with two numbers. Requires approval for large numbers.",
          inputSchema: z.object({
            a: z.number().describe("First number"),
            b: z.number().describe("Second number"),
            operator: z
              .enum(["+", "-", "*", "/", "%"])
              .describe("Arithmetic operator")
          }),
          needsApproval: async ({ a, b }: { a: number; b: number }) =>
            Math.abs(a) > 1000 || Math.abs(b) > 1000,
          execute: async ({ a, b, operator }: { a: number; b: number; operator: "+" | "-" | "*" | "/" | "%" }) => {
            const ops: Record<"+" | "-" | "*" | "/" | "%", (x: number, y: number) => number> = {
              "+": (x, y) => x + y,
              "-": (x, y) => x - y,
              "*": (x, y) => x * y,
              "/": (x, y) => x / y,
              "%": (x, y) => x % y
            };
            if (operator === "/" && b === 0) {
              return { error: "Division by zero" };
            }
            const fn = ops[operator];
            return {
              expression: `${a} ${operator} ${b}`,
              result: fn ? fn(a, b) : null
            };
          }
        })
      },
      stopWhen: stepCountIs(5)
    });

    return result.toDataStreamResponse();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await routeAgentRequest(request, env);
    return response || new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
