import { GoogleGenerativeAI, Content } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `You are an HR assistant for Alliance Global Solutions.
Answer questions strictly based on the provided company documents.
If a question cannot be answered from the documents, respond with:
"I don't have that information in the provided documents. Please contact HR directly."
Do not make assumptions or answer questions outside the scope of the documents.`;

export async function generateChatReply(
  message: string,
  history: Content[],
  pdfBuffers: Buffer[],
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_PROMPT,
  });

  const inlinePdfs = pdfBuffers.map((buf) => ({
    inlineData: {
      mimeType: "application/pdf" as const,
      data: buf.toString("base64"),
    },
  }));

  const chat = model.startChat({ history });

  const result = await chat.sendMessage([
    ...inlinePdfs,
    { text: message },
  ]);

  return result.response.text();
}
