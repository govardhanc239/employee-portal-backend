import { db } from "../config/db.js";


// ========LEAVES LIST========

export const getLeaveBalance = async(req,res)=>{
    try {
        const employeeId = req.user.id;
        const [rows]= await db.query(`
            SELECT * FROM leave_balance WHERE employee_id = ?`, [employeeId]
            );
            if (rows.length === 0) {
      return res.status(404).json({ message: "Leave balance not found" });
    }
    console.log("Leave Balance fetched:", rows[0]);
    return res.json(rows[0]);
    }catch (err) {
    console.error("Get Leave Balance Error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// =============GET MY LEAVE REQUESTS==================

export const getMyLeaves = async (req, res) => {
  try {
    const employeeId = req.user.id;

    const [rows] = await db.query(
      "SELECT * FROM leaves WHERE employee_id = ? ORDER BY created_at DESC",
      [employeeId]
    );

    return res.json(rows);

  } catch (err) {
    console.error("Get My Leaves Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ============LEAVE APPLYING==================

export const applyLeave = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { leave_type, start_date, end_date, reason, attachment_url = null } = req.body;
    
    console.log("Employee ID:", employeeId);
    console.log("Leave Application Data:", req.body);
    // Validate required fields
    if (!leave_type || !start_date || !end_date) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate date order
    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ message: "Start date cannot be after end date" });
    }

    // Calculate total days
    const diff = Math.abs(new Date(end_date) - new Date(start_date));
    const total_days = diff / (1000 * 60 * 60 * 24) + 1;

    // Fetch current leave balance
    const [balance] = await db.query(
      "SELECT * FROM leave_balance WHERE employee_id = ? AND year = YEAR(CURDATE())",
      [employeeId]
    );

    console.log("Current Balance:", balance);
    if (!balance.length) {
      return res.status(400).json({ message: "Leave balance not found" });
    }

    const b = balance[0];

    // Determine available balance
    const leaveMap = {
      CL: b.casual_leave,
      SL: b.sick_leave,
      PL: b.privilege_leave,
      LOP: 9999 // No restriction
    };

    // Check balance
    if (total_days > leaveMap[leave_type]) {
      return res.status(400).json({
        message: `Insufficient ${leave_type} balance`
      });
    }

    // Insert leave request
    const [result] = await db.query(
      `INSERT INTO leaves (
          employee_id, leave_type, start_date, end_date, total_days, 
          reason, attachment_url
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [employeeId, leave_type, start_date, end_date, total_days, reason, attachment_url]
    );

    // Deduct balance immediately (except LOP)
    if (leave_type !== "LOP") {
      const column =
        leave_type === "CL"
          ? "casual_leave"
          : leave_type === "SL"
          ? "sick_leave"
          : "privilege_leave";

      await db.query(
        `UPDATE leave_balance 
         SET ${column} = ${column} - ?
         WHERE employee_id = ? AND year = YEAR(CURDATE())`,
        [total_days, employeeId]
      );
    }

    return res.status(201).json({
      message: "Leave applied successfully (sent to RM)",
      leave_id: result.insertId
    });

  } catch (err) {
    console.error("Apply Leave Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// =============LEAVE SUMMARY FOR RM===================


export const getRMLeaveSummary = async (req, res) => {
  try {
    const rmId = req.user.id;

    // Check RM team
    const [team] = await db.query(
      "SELECT id, name, employee_code FROM employees WHERE reporting_manager_id = ?",
      [rmId]
    );

    if (team.length === 0) {
      return res.status(200).json({
        success: true,
        pending: [],
        approved: [],
        rejected: [],
        message: "No team members under you"
      });
    }

    // Query all leaves of all team members
    const [rows] = await db.query(
      `
      SELECT 
        l.*, 
        e.name AS employee_name, 
        e.employee_code,
        e.department,
        e.designation
      FROM leaves l
      INNER JOIN employees e ON e.id = l.employee_id
      WHERE e.reporting_manager_id = ?
      ORDER BY l.created_at DESC
      `,
      [rmId]
    );

    // Group into 3 arrays
    const pending = [];
    const approved = [];
    const rejected = [];

    rows.forEach((leave) => {
      if (leave.status === "pending") pending.push(leave);
      else if (leave.status === "approved") approved.push(leave);
      else if (leave.status === "rejected") rejected.push(leave);
    });

    return res.json({
      success: true,
      pending,
      approved,
      rejected
    });

  } catch (error) {
    console.error("Error fetching RM leave summary:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// =================REVIEW LEAVE REQUEST===================


export const reviewLeaveRequest = async (req, res) => {
  try {
    const leaveId = req.params.id;
    const rmId = req.user.id;
    const { status, comment } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Fetch leave request
    const [rows] = await db.query(
      "SELECT * FROM leaves WHERE id = ?",
      [leaveId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Leave not found" });
    }

    const leave = rows[0];

    // Prevent re-reviewing
    if (leave.status !== "pending") {
      return res.status(400).json({
        message: `This request is already ${leave.status}`
      });
    }

    // ==============================
    // IF REJECT → Restore Leave Balance
    // ==============================
    if (status === "rejected" && leave.leave_type !== "LOP") {
      const column =
        leave.leave_type === "CL"
          ? "casual_leave"
          : leave.leave_type === "SL"
          ? "sick_leave"
          : "privilege_leave";

      await db.query(
        `UPDATE leave_balance
         SET ${column} = ${column} + ?
         WHERE employee_id = ? AND year = YEAR(CURDATE())`,
        [leave.total_days, leave.employee_id]
      );
    }

    // ==============================
    // UPDATE LEAVE REQUEST
    // ==============================
    await db.query(
      `
      UPDATE leaves
      SET status = ?, 
          approved_by = ?, 
          approved_at = IF(?='approved', NOW(), approved_at),
          rejected_at = IF(?='rejected', NOW(), rejected_at),
          rejection_reason = IF(?='rejected', ?, NULL)
      WHERE id = ?
      `,
      [
        status,
        rmId,
        status,
        status,
        status,
        comment || null,
        leaveId,
      ]
    );

    return res.json({
      success: true,
      message: `Leave ${status} successfully`,
    });

  } catch (err) {
    console.error("Leave Review Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
