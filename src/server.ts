import { routeAgentRequest } from "agents";
import { AIChatAgent } from "@cloudflare/ai-chat";
import { withDurableChat } from "@cloudflare/ai-chat/experimental/forever";
import { streamText, convertToModelMessages, pruneMessages, tool, stepCountIs } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";

export interface Env {
  AI: unknown;
}

const DurableChatAgent = withDurableChat(AIChatAgent);

export class ForeverChatAgent extends DurableChatAgent<Env> {
  public maxPersistedMessages = 200;

  async onChatMessage(): Promise<Response> {
    const workersai = createWorkersAI({ binding: this.env.AI });

    const result = streamText({
      model: workersai("@cf/zai-org/glm-4.7-flash"),
      system:
        "You are an advanced enterprise AI assistant operating directly on Cloudflare's V8 isolates. " +
        "Your streaming connection is kept alive via keepAlive(), ensuring seamless execution for complex tasks. " +
        "Your responses must be highly accurate, concise, and professional. " +
        "You have access to live tools for real-time data processing and verified calculations.",
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages",
        reasoning: "before-last-message"
      }),
      tools: {
        getWeather: tool({
          description: "Get the real-time weather conditions for a specified city using external network APIs.",
          inputSchema: z.object({
            city: z.string().describe("City name")
          }),
          execute: async ({ city }: { city: string }) => {
            try {
              const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
              if (!res.ok) {
                return { error: `HTTP error: ${res.status} resolving external weather endpoint.` };
              }
              const data = await res.json() as any;
              const current = data.current_condition[0];
              return {
                city,
                temperature: Number(current.temp_C),
                condition: current.weatherDesc[0].value,
                humidity: `${current.humidity}%`,
                wind: `${current.windspeedKmph} km/h`,
                unit: "celsius"
              };
            } catch (err) {
              return { error: "Failed to fetch remote weather data. Network unreachable." };
            }
          }
        }),

        getUserTimezone: tool({
          description: "Retrieve the local timezone of the user to provide context-aware temporal responses.",
          inputSchema: z.object({})
        }),

        calculate: tool({
          description: "Perform precise arithmetic calculations. Requires explicit user approval for any operand exceeding 1000.",
          inputSchema: z.object({
            a: z.number().describe("First operand"),
            b: z.number().describe("Second operand"),
            operator: z.enum(["+", "-", "*", "/", "%"]).describe("Mathematical operator")
          }),
          needsApproval: async ({ a, b }: { a: number; b: number }) => Math.abs(a) > 1000 || Math.abs(b) > 1000,
          execute: async ({ a, b, operator }: { a: number; b: number; operator: "+" | "-" | "*" | "/" | "%" }) => {
            const operations: Record<"+" | "-" | "*" | "/" | "%", (x: number, y: number) => number> = {
              "+": (x, y) => x + y,
              "-": (x, y) => x - y,
              "*": (x, y) => x * y,
              "/": (x, y) => x / y,
              "%": (x, y) => x % y
            };
            if (operator === "/" && b === 0) {
              return { error: "Division by zero is mathematically undefined." };
            }
            return {
              expression: `${a} ${operator} ${b}`,
              result: operations[operator](a, b)
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
