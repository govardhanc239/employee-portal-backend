import { db } from "../config/db.js";

/* ================= CLOCK-IN ===================== */
export const clockIn = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const [dayRows] = await db.query(
      "SELECT * FROM attendance_days WHERE employee_id = ? AND date = ?",
      [employeeId, today]
    );

    let dayId;

    if (dayRows.length === 0) {
      const officeStart = new Date();
      officeStart.setHours(9, 30, 0, 0);

      const status = now <= officeStart ? "on-time" : "late";

      const [result] = await db.query(
        "INSERT INTO attendance_days (employee_id, date, status) VALUES (?, ?, ?)",
        [employeeId, today, status]
      );

      dayId = result.insertId;
    } else {
      dayId = dayRows[0].id;
    }

    const [openSession] = await db.query(
      "SELECT * FROM attendance_sessions WHERE day_id = ? AND clock_out IS NULL",
      [dayId]
    );

    if (openSession.length > 0) {
      return res.status(400).json({
        message: "You already have an active session. Please clock-out first.",
      });
    }

    await db.query(
      "INSERT INTO attendance_sessions (day_id, clock_in) VALUES (?, ?)",
      [dayId, now]
    );

    return res.json({
      message: "Clock-in successful",
      clock_in: now,
      day_id: dayId,
    });
  } catch (err) {
    console.error("Clock-in Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= CLOCK-OUT ===================== */
export const clockOut = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);

    const [dayRows] = await db.query(
      "SELECT * FROM attendance_days WHERE employee_id = ? AND date = ?",
      [employeeId, today]
    );

    if (dayRows.length === 0) {
      return res.status(400).json({ message: "You haven't clocked in yet" });
    }

    const dayId = dayRows[0].id;

    const [sessions] = await db.query(
      "SELECT * FROM attendance_sessions WHERE day_id = ? AND clock_out IS NULL",
      [dayId]
    );

    if (sessions.length === 0) {
      return res.status(400).json({ message: "No active clock-in session found" });
    }

    const session = sessions[0];
    const now = new Date();
    const clockInTime = new Date(session.clock_in);

    let finalClockOut = now;
    let isAuto = false;

    const diffHours = (now - clockInTime) / (1000 * 60 * 60);

    if (diffHours >= 12) {
      finalClockOut = new Date(clockInTime.getTime() + 12 * 60 * 60 * 1000);
      isAuto = true;
    }

    const duration = (finalClockOut - clockInTime) / (1000 * 60 * 60);

    await db.query(
      "UPDATE attendance_sessions SET clock_out = ?, duration = ?, is_auto_clockout = ? WHERE id = ?",
      [finalClockOut, duration.toFixed(2), isAuto, session.id]
    );

    await db.query(
      "UPDATE attendance_days SET total_hours = total_hours + ? WHERE id = ?",
      [duration.toFixed(2), dayId]
    );

    return res.json({
      message: isAuto ? "Auto Clock-Out applied (12 hours)" : "Clock-out successful",
      clock_out: finalClockOut,
      duration: duration.toFixed(2),
    });
  } catch (err) {
    console.error("Clock-out Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================ TODAY'S ATTENDANCE ================= */
export const getTodayAttendance = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);

    const [dayRows] = await db.query(
      "SELECT * FROM attendance_days WHERE employee_id = ? AND date = ?",
      [employeeId, today]
    );

    if (dayRows.length === 0) {
      return res.json({ day: null, sessions: [] });
    }

    const dayId = dayRows[0].id;

    const [sessions] = await db.query(
      "SELECT * FROM attendance_sessions WHERE day_id = ? ORDER BY clock_in ASC",
      [dayId]
    );

    return res.json({
      day: dayRows[0],
      sessions,
    });

  } catch (err) {
    console.error("Fetch Today Attendance Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET ALL ATTENDANCE (LIST) ================== */
export const getAttendanceList = async (req, res) => {
  try {
    const employeeId = req.user.id;

    const [days] = await db.query(
      `
      SELECT 
          ad.id,
          ad.date,
          ad.status,
          ad.total_hours,
          (SELECT clock_in FROM attendance_sessions WHERE day_id = ad.id ORDER BY clock_in ASC LIMIT 1) AS first_clock_in,
          (SELECT clock_out FROM attendance_sessions WHERE day_id = ad.id ORDER BY clock_out DESC LIMIT 1) AS last_clock_out,
          (SELECT COUNT(*) FROM attendance_sessions WHERE day_id = ad.id AND is_auto_clockout = 1) > 0 AS has_auto_clockout
      FROM attendance_days ad
      WHERE ad.employee_id = ?
      ORDER BY ad.date DESC
      `,
      [employeeId]
    );

    for (const day of days) {
      const [sessions] = await db.query(
        "SELECT * FROM attendance_sessions WHERE day_id = ?",
        [day.id]
      );

      for (const session of sessions) {
        const [reg] = await db.query(
          "SELECT * FROM regularization_requests WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
          [session.id]
        );

        session.regularization = reg[0] || null;
      }

      day.sessions = sessions;
    }

    return res.json(days);

  } catch (err) {
    console.error("Attendance List Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET SESSIONS FOR A SPECIFIC DAY ================== */
export const getDaySessions = async (req, res) => {
  try {
    const dayId = req.params.dayId;

    const [sessions] = await db.query(
      "SELECT * FROM attendance_sessions WHERE day_id = ? ORDER BY clock_in ASC",
      [dayId]
    );

    const [day] = await db.query(
      "SELECT * FROM attendance_days WHERE id = ?",
      [dayId]
    );

    return res.json({
      day: day[0] || null,
      sessions
    });

  } catch (err) {
    console.error("Get Day Sessions Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
