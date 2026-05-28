import { GoogleGenerativeAI, Content } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `You are an HR assistant for Alliance Global Solutions.
Answer questions strictly based on the provided company documents.
If a question cannot be answered from the documents, respond with:
"I don't have that information in the provided documents. Please contact HR directly."
Do not make assumptions or answer questions outside the scope of the documents.`;

export async function* generateChatReplyStream(
  message: string,
  history: Content[],
  documentTexts: string[],
): AsyncGenerator<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as any,
  });

  const docParts = documentTexts.map((text) => ({ text }));

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream([
    { text: SYSTEM_PROMPT },
    ...docParts,
    { text: message },
  ]);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}
