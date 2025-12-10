import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";

import {
  createRegularization,
  myRegularizations,
  teamRegularizations,
  reviewRegularization
} from "../controllers/regularizationController.js";

const router = express.Router();

// Employee creates request
router.post("/", verifyToken, createRegularization);

// Employee sees own requests
router.get("/my", verifyToken, myRegularizations);

// RM gets requests from team
router.get("/team", verifyToken, teamRegularizations);

// RM approves or rejects
router.put("/review/:id", verifyToken, reviewRegularization);

export default router;
