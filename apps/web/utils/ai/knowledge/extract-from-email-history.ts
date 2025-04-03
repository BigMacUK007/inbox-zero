import { z } from "zod";
import { createScopedLogger } from "@/utils/logger";
import { chatCompletionObject } from "@/utils/llms";
import type { UserEmailWithAI } from "@/utils/llms/types";
import type { EmailForLLM } from "@/utils/types";
import { stringifyEmail } from "@/utils/stringify-email";
import { getEconomyModel } from "@/utils/llms/model-selector";

const logger = createScopedLogger("EmailHistoryExtractor");

const SYSTEM_PROMPT = `You are an email history analysis agent. Your task is to analyze the provided historical email threads and extract relevant information that would be helpful for drafting a response to the current email thread.

Your task:
1. Analyze the historical email threads to understand relevant past context and interactions
2. Identify key points, commitments, questions, and unresolved items from previous conversations
3. Extract any relevant dates, deadlines, or time-sensitive information mentioned in past exchanges
4. Note any specific preferences or communication patterns shown in previous exchanges

Provide a concise summary (max 500 characters) that captures the most important historical context needed for drafting a response to the current thread. Focus on:
- Key unresolved points or questions from past exchanges
- Any commitments or promises made in previous conversations
- Important dates or deadlines established in past emails
- Notable preferences or patterns in communication`;

const USER_PROMPT = ({
  currentThreadMessages,
  historicalMessages,
  user,
}: {
  currentThreadMessages: EmailForLLM[];
  historicalMessages: EmailForLLM[];
  user: UserEmailWithAI;
}) => {
  return `Current Email Thread:
${currentThreadMessages.map((m) => stringifyEmail(m, 10000)).join("\n---\n")}

${
  historicalMessages.length > 0
    ? `Historical Email Threads:
${historicalMessages.map((m) => stringifyEmail(m, 10000)).join("\n---\n")}`
    : "No historical email threads available."
}

${
  user.about
    ? `<user_info>
<about>${user.about}</about>
<email>${user.email}</email>
</user_info>`
    : `<user_info>
<email>${user.email}</email>
</user_info>`
}

Analyze the historical email threads and extract any relevant information that would be helpful for drafting a response to the current email thread. Provide a concise summary of the key historical context.`;
};

const extractionSchema = z.object({
  summary: z
    .string()
    .describe(
      "A concise summary of relevant historical context, including key points, commitments, deadlines, and communication patterns from past conversations",
    ),
});

export async function aiExtractFromEmailHistory({
  currentThreadMessages,
  historicalMessages,
  user,
}: {
  currentThreadMessages: EmailForLLM[];
  historicalMessages: EmailForLLM[];
  user: UserEmailWithAI;
}): Promise<string | null> {
  try {
    logger.info("Extracting information from email history", {
      currentThreadCount: currentThreadMessages.length,
      historicalCount: historicalMessages.length,
    });

    if (historicalMessages.length === 0) return null;

    const system = SYSTEM_PROMPT;
    const prompt = USER_PROMPT({
      currentThreadMessages,
      historicalMessages,
      user,
    });

    logger.trace("Input", { system, prompt });

    // Get the economy model for this high-context task
    const { provider, model } = getEconomyModel(user);
    logger.info("Using economy model for email history extraction", {
      provider,
      model,
    });

    const result = await chatCompletionObject({
      system,
      prompt,
      schema: extractionSchema,
      usageLabel: "Email history extraction",
      userAi: { ...user, aiProvider: provider, aiModel: model },
      userEmail: user.email,
    });

    logger.trace("Output", result.object);

    return result.object.summary;
  } catch (error) {
    logger.error("Failed to extract information from email history", { error });
    return null;
  }
}
