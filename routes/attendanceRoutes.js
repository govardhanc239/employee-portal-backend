import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { clockIn, clockOut, getAttendanceList, getDaySessions, getTodayAttendance } from "../controllers/attendanceController.js";

const router = express.Router();

router.post("/clock-in", verifyToken, clockIn);
router.post("/clock-out", verifyToken, clockOut);
router.get("/today", verifyToken, getTodayAttendance);
router.get("/sessions/:dayId", verifyToken, getDaySessions);
router.get("/list", verifyToken, getAttendanceList);

export default router;
