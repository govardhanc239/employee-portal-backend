import { db } from "../config/db.js";

// --------------- CREATE REGULARIZATION REQUEST ------------------
export const createRegularization = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { session_id, corrected_out, reason } = req.body;

    console.log("regularization",req.body)

    if (!session_id || !corrected_out || !reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check session exists
    const [sessionRows] = await db.query(
      "SELECT * FROM attendance_sessions WHERE id = ? AND day_id IN (SELECT id FROM attendance_days WHERE employee_id = ?)",
      [session_id, employeeId]
    );

    if (sessionRows.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    const session = sessionRows[0];

    if (!session.is_auto_clockout) {
      return res.status(400).json({ message: "Regularization allowed only for auto clock-out sessions" });
    }

    // Check if there is already a pending/approved request for this session
    const [existing] = await db.query(
      "SELECT * FROM regularization_requests WHERE session_id = ? AND status IN ('pending','approved')",
      [session_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "You already submitted a request for this session" });
    }

    // Insert request
    await db.query(
      `INSERT INTO regularization_requests 
       (employee_id, session_id, requested_out, reason) 
       VALUES (?, ?, ?, ?)`,
      [employeeId, session_id, corrected_out, reason]
    );

    return res.json({ message: "Regularization request submitted successfully" });

  } catch (err) {
    console.error("Regularization Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ===================MY_REQUESTS====================


export const myRegularizations = async (req, res) => {
  try {
    const employeeId = req.user.id;

    const [rows] = await db.query(`
      SELECT rr.*, s.clock_in, s.clock_out, s.is_auto_clockout, ad.date
      FROM regularization_requests rr
      JOIN attendance_sessions s ON rr.session_id = s.id
      JOIN attendance_days ad ON s.day_id = ad.id
      WHERE rr.employee_id = ?
      ORDER BY rr.created_at DESC
    `, [employeeId]);

    res.json(rows);

  } catch (err) {
    console.error("Fetch My Regularizations Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ========================TEAM_REGULARIZATIONS===================
export const teamRegularizations = async (req, res) => {
  try {
    const rmId = req.user.id;

    const [rows] = await db.query(`
      SELECT rr.*, e.name AS employee_name, ad.date, s.clock_in, s.clock_out
      FROM regularization_requests rr
      JOIN employees e ON rr.employee_id = e.id
      JOIN attendance_sessions s ON rr.session_id = s.id
      JOIN attendance_days ad ON s.day_id = ad.id
      WHERE e.reporting_manager_id = ?
      ORDER BY rr.created_at DESC
    `, [rmId]);

    res.json(rows);

  } catch (err) {
    console.error("Fetch Team Regularizations Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ===================SINGLE_REGULARIZATION==============================

export const reviewRegularization = async (req, res) => {
  try {
    const rmId = req.user.id;
    const requestId = req.params.id;
    const { status, comment } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Fetch request details
    const [rows] = await db.query(`
      SELECT rr.*, e.reporting_manager_id, s.clock_in
      FROM regularization_requests rr
      JOIN employees e ON rr.employee_id = e.id
      JOIN attendance_sessions s ON rr.session_id = s.id
      WHERE rr.id = ?
    `, [requestId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Request not found" });
    }

    const reqData = rows[0];

    if (reqData.reporting_manager_id !== rmId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // APPROVED → Update session
    if (status === "approved") {
      const correctedOut = new Date(reqData.requested_out);
      const clockIn = new Date(reqData.clock_in);
      const duration = (correctedOut - clockIn) / (1000 * 60 * 60);

      await db.query(`
        UPDATE attendance_sessions 
        SET clock_out = ?, duration = ?, is_auto_clockout = 0 
        WHERE id = ?
      `, [correctedOut, duration.toFixed(2), reqData.session_id]);

      await db.query(`
        UPDATE attendance_days 
        SET total_hours = (
          SELECT SUM(duration) FROM attendance_sessions WHERE day_id = attendance_days.id
        )
      WHERE id = (SELECT day_id FROM attendance_sessions WHERE id = ?)
      `, [reqData.session_id]);
    }

    // Update request
    await db.query(
      `UPDATE regularization_requests
       SET status = ?, reviewed_by = ?, review_comment = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [status, rmId, comment || null, requestId]
    );

    res.json({ message: `Request ${status}` });

  } catch (err) {
    console.error("Review Regularization Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
