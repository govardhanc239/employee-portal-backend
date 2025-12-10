import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { aiPromptGuard } from "../middleware/aiPromptGuard.js";
import { aiBridge } from "../ai/aiBridgeController.js";

const router = express.Router();

router.post("/ask", verifyToken, aiPromptGuard, aiBridge);

export default router;
