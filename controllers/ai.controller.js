import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { db } from "../config/db.js";
import axios from "axios";

const router = express.Router();

router.post("/", verifyToken, async (req, res) => {
  const { question } = req.body;
  const user = req.user;

  // Example access control logic
  if (
    question.toLowerCase().includes("colleague") ||
    question.toLowerCase().includes("team member") ||
    question.toLowerCase().includes("other employee")
  ) {
    // Only RM/HR can see team/colleague info
    if (user.role !== "hr" && user.team_count === 0) {
      return res.status(403).json({
        message: "Access denied. You cannot view other employees' data.",
      });
    }
  }

  // Compose context for Ollama
  const context = `
You are an AI assistant for an employee portal.
User: ${user.name} (${user.role}, grade: ${user.grade}, department: ${user.department})
Question: ${question}
`;

  // Call Ollama Phi-3 model
  try {
    const ollamaRes = await axios.post("http://localhost:11434/api/generate", {
      model: "phi3",
      prompt: context,
      stream: false,
    });

    res.json({ answer: ollamaRes.data.response });
  } catch (err) {
    res.status(500).json({ message: "AI model error", error: err.message });
  }
});

export default router;