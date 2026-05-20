import { GoogleGenerativeAI } from "@google/generative-ai";

import ENV from "../../../db/env";

const genAI = new GoogleGenerativeAI(
  ENV.GEMINI.API_KEY!
);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

interface GenerateOptions {
  prompt: string;

  temperature?: number;

  maxOutputTokens?: number;
}

export async function generateText({
  prompt,
  temperature = 0.5,
  maxOutputTokens = 512,
}: GenerateOptions) {
  const result =
    await model.generateContent({
      contents: [
        {
          role: "user",

          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],

      generationConfig: {
        temperature,
        maxOutputTokens,
      },
    });

  return (
    result.response?.text()?.trim() ??
    ""
  );
}