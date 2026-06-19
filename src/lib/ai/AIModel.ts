import { Mistral } from "@mistralai/mistralai";
import ENV from "../../../db/env";
import { buildInsightsPrompt, buildQuestionPrompt, SYSTEM_PROMPT } from "./prompts";

const client = new Mistral({
  apiKey: ENV.MINSTRAL.API_KEY,
});

interface GenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export async function generateText({
  systemPrompt,
  userPrompt,
  temperature = 0.5,
  maxTokens = 512,
}: GenerateOptions): Promise<string> {
  const response = await client.chat.complete({
    model: "mistral-small-latest",

    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],

    temperature,
    maxTokens,
  });

  const content = response.choices?.[0]?.message?.content;

  return typeof content === "string" ? content.trim() : "";
}

export async function chatWithRayo(params: {
  context: string;
  question: string;
  roastMode: boolean;
  userName?: string;
}) {
  return generateText({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildQuestionPrompt(params),
    temperature: 0.6,
    maxTokens: 600,
  });
}

export async function generateInsights(params: {
  context: string;
  userName?: string;
}) {
  return generateText({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildInsightsPrompt(
      params.context,
      params.userName
    ),
    temperature: 0.4,
    maxTokens: 800,
  });
}