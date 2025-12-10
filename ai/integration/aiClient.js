import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const callGemini = async (messages) => {
  try {
    // Compose prompt from messages
    const prompt = messages.map(m => m.content).join("\n");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
    });

    // Gemini returns .text
    return { content: response.text };
  } catch (err) {
    console.error("Gemini Error:", err.message);
    throw new Error("AI service failure");
  }
};