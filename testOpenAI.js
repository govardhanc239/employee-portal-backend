import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function test() {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: "Say hello in one sentence" }
      ]
    });

    console.log("✅ API Working!");
    console.log(response.choices[0].message.content);

  } catch (err) {
    console.error("❌ API Error:");
    console.error(err.message);
  }
}

test();
