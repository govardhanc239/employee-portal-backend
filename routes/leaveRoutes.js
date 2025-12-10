import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { applyLeave, getLeaveBalance, getMyLeaves, getRMLeaveSummary, reviewLeaveRequest } from "../controllers/leaveController.js";

const router = express.Router();

router.get("/balance", verifyToken, getLeaveBalance);

router.post("/apply", verifyToken, applyLeave);


router.get("/my-leaves", verifyToken, getMyLeaves);

router.get('/leave-summary', verifyToken, getRMLeaveSummary);

router.put("/review/:id", verifyToken, reviewLeaveRequest);


export default router;