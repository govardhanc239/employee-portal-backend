import fs from "fs";
import path from "path";
import { callGemini } from "./integration/aiClient.js";

import {
  applyLeave,
  reviewLeaveRequest,
  getMyLeaves
} from "../controllers/leaveController.js";

import {
  clockIn,
  clockOut,
  getAttendanceList
} from "../controllers/attendanceController.js";

import { createRegularization } from "../controllers/regularizationController.js";
import { db } from "../config/db.js";

/* =========================
   PROMPT READER
========================= */

const readPrompt = (file) =>
  fs.readFileSync(path.join(process.cwd(), "/ai/prompts", file), "utf-8");

/* =========================
   DATE NORMALIZER
========================= */

function normalizeDateInput(value) {
  if (!value) return null;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  const todayStr = `${yyyy}-${mm}-${dd}`;

  if (typeof value === "string") {
    const v = value.toLowerCase().trim();

    if (v === "today") return todayStr;

    if (v === "tomorrow") {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    }

    // If only a day is given like "15"
    if (/^\d{1,2}$/.test(v)) {
      return `${yyyy}-${mm}-${String(v).padStart(2, "0")}`;
    }
  }

  return value; // already in YYYY-MM-DD
}

/* =========================
   AI BRIDGE CONTROLLER
========================= */

export const aiBridge = async (req, res) => {
  try {
    const { question } = req.body;
    console.log("[AI Bridge] Incoming:", req.body);

    /* --------- Build System Prompt --------- */
    let systemPrompt = readPrompt("system.txt");
    const currentYear = new Date().getFullYear();
    systemPrompt = systemPrompt.replace(/\$\{CURRENT_YEAR\}/g, String(currentYear));

    systemPrompt +=
      "\n\nEmployee Actions:\n" +
      readPrompt("employee-actions.txt") +
      "\n\nRM Actions:\n" +
      readPrompt("rm-actions.txt");

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: question }
    ];

    /* --------- Call Gemini --------- */
    const aiResponse = await callGemini(messages);

    if (!aiResponse?.content) {
      throw new Error("Empty AI response");
    }

    let rawText = aiResponse.content.trim();

    if (rawText.startsWith("```json")) {
      rawText = rawText.replace(/^```json/, "").replace(/```$/, "").trim();
    }

    /* --------- Try JSON Parse --------- */
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      // Plain text generic answer fallback (2 lines)
      return res.json({ message: rawText });
    }

    /* --------- Multiple Actions --------- */
    if (Array.isArray(parsed)) {
      const results = [];
      for (const actionObj of parsed) {
        results.push(await handleAIAction(actionObj, req, res, question));
      }
      return res.json({ results });
    }

    /* --------- Single Action --------- */
    return handleAIAction(parsed, req, res, question);

  } catch (err) {
    console.error("AI Bridge Error:", err);
    return res.status(500).json({ message: "AI Bridge failed" });
  }
};

/* =========================
   ACTION HANDLER
========================= */

async function handleAIAction(parsed, req, res, question) {

  switch (parsed.action) {

    /* =========================
       APPLY LEAVE
    ========================= */

    case "APPLY_LEAVE": {
      const payload = parsed.payload || {};

      const mappedPayload = {
        leave_type: payload.leave_type || payload.leaveType || "CL",
        start_date: normalizeDateInput(payload.start_date || payload.startDate),
        end_date: normalizeDateInput(payload.end_date || payload.endDate),
        reason: payload.reason || "AI generated request"
      };

      if (!mappedPayload.start_date || !mappedPayload.end_date) {
        return res.status(400).json({
          action: "DENIED",
          reason: "Start date and end date are required"
        });
      }

      return applyLeave({ ...req, body: mappedPayload }, res);
    }

    /* =========================
       REGULARIZATION
    ========================= */

    case "REQUEST_REGULARIZATION":
      return createRegularization(req, res, parsed.payload);

    /* =========================
       SELF DATA
    ========================= */

    case "GET_MY_LEAVES":
      return getMyLeaves(req, res);

    case "GET_MY_ATTENDANCE":
      return getAttendanceList(req, res);

    /* =========================
       APPROVE / REJECT LEAVE
    ========================= */

    case "APPROVE_LEAVE":
    case "REJECT_LEAVE": {
      const payload = parsed.payload || {};
      let leaveId = payload.leave_id;

      if (!payload.employee_name && question) {
        const nameMatch = question.match(/approve (.+?) leave/i);
        if (nameMatch) payload.employee_name = nameMatch[1].trim();
      }

      if (!payload.start_date && question) {
        const dateMatch = question.match(/on (\d{1,2})/i);
        if (dateMatch) payload.start_date = normalizeDateInput(dateMatch[1]);
      }

      payload.start_date = normalizeDateInput(payload.start_date);
      payload.end_date = normalizeDateInput(payload.end_date || payload.start_date);

      if (!leaveId && payload.employee_name && payload.start_date && payload.end_date) {
        const [users] = await db.query(
          "SELECT id FROM employees WHERE name = ?",
          [payload.employee_name]
        );

        if (users.length) {
          const empId = users[0].id;

          const [leaves] = await db.query(
            "SELECT id FROM leaves WHERE employee_id = ? AND start_date = ? AND end_date = ?",
            [empId, payload.start_date, payload.end_date]
          );

          if (leaves.length) {
            leaveId = leaves[0].id;
          }
        }
      }

      if (!leaveId) {
        return res.status(400).json({
          action: "DENIED",
          reason: "Not enough information to identify leave"
        });
      }

      req.params.id = leaveId;
      req.body.status = parsed.action === "APPROVE_LEAVE" ? "approved" : "rejected";
      req.body.comment = payload.comment || "";

      return reviewLeaveRequest(req, res);
    }

    /* =========================
       DENIED
    ========================= */

    case "DENIED":
      return res.json(parsed);

    /* =========================
       UNKNOWN
    ========================= */

    default:
      return res.json({
        message: "Action not recognized",
        aiResponse: parsed
      });
  }
}
