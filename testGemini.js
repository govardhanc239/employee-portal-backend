import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config(); // load .env

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function main() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",   // ✅ WORKING MODEL
      contents: [
        {
          role: "user",
          parts: [{ text: "Explain how AI works in 2 simple lines" }]
        }
      ],
    });

    console.log("✅ Gemini Response:\n", response.text);

  } catch (err) {
    console.error("❌ Gemini API Error:\n", err.message || err);
  }
}

main();
