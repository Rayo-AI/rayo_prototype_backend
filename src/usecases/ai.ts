import {
  generateText,
} from "../lib/ai/gemini";

import {
  buildInsightsPrompt,
  buildQuestionPrompt,
} from "../lib/ai/prompts";

import {
  isBlockedTopic,
  isFinanceIntent,
  isRoastMode,
  SAFE_REDIRECT,
} from "../lib/ai/filters";

import {
  buildFinancialContext,
} from "./financial-context";

export class AiUseCase {
  static async askQuestion(
    userId: number,
    question: string
  ) {
    const normalized =
      question.toLowerCase().trim();

    if (
      isBlockedTopic(normalized)
    ) {
      return "I no dey give investment or non-finance advice sha 😭 But I fit help you understand your spending habits better.";
    }

    const roastMode =
      isRoastMode(normalized);

    const context =
      await buildFinancialContext(
        userId
      );

    const hasContext =
      context.formattedContext.length > 0;

    if (
      !isFinanceIntent(normalized) &&
      !hasContext
    ) {
      return SAFE_REDIRECT;
    }

    const prompt =
      buildQuestionPrompt({
        context: context.formattedContext,
        question,
        roastMode,
      });

    return generateText({
      prompt,

      temperature: roastMode
        ? 0.75
        : 0.5,
    });
  }

  static async generateInsights(
    userId: number
  ) {
    const context =
      await buildFinancialContext(
        userId
      );

    const prompt =
      buildInsightsPrompt(
        context.formattedContext
      );

    const text =
      await generateText({
        prompt,
      });

    try {
      return JSON.parse(
        text.replace(
          /```json|```/g,
          ""
        )
      );
    } catch {
      return [
        {
          id: "fallback",

          type: "suggestion",

          message:
            "Track first, gist later 👀",

          detail:
            "Add more transactions so Rayo fit understand your spending habits better.",
        },
      ];
    }
  }
}