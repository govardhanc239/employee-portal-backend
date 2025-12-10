import { db } from "../config/db.js";
import bcrypt from "bcryptjs";
import xss from "xss";

export const createEmployee = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      role,
      grade,
      designation,
      department,
      password,
      reporting_manager_id   // ⭐ Frontend sends ID here
    } = req.body;

    // Basic validations
    if (!name || !email || !password || !role || !grade || !department) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Sanitize inputs
    const cleanName = xss(name);
    const cleanEmail = xss(email);
    const cleanDesignation = xss(designation);

    // Prevent self being RM (future proof)
    if (reporting_manager_id && reporting_manager_id === req.user.id) {
      return res
        .status(400)
        .json({ message: "User cannot assign themselves as RM" });
    }

    // Validate reporting manager
    if (reporting_manager_id) {
      const [rm] = await db.query(
        "SELECT id FROM employees WHERE id = ?",
        [reporting_manager_id]
      );

      if (rm.length === 0) {
        return res.status(400).json({ message: "Invalid reporting manager" });
      }
    }

    // Check duplicate email
    const [existing] = await db.query(
      "SELECT id FROM employees WHERE email = ?",
      [cleanEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get next employee code using AUTO_INCREMENT
    const [rows] = await db.query(`
      SELECT AUTO_INCREMENT
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'employees'
    `);

    const nextId = rows[0]?.AUTO_INCREMENT;
    const employeeCode = `EMP${nextId}`;

    // Insert employee
    const [result] = await db.query(
      `INSERT INTO employees 
      (employee_code, name, email, phone, password, role, grade, designation, department, reporting_manager_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employeeCode,
        cleanName,
        cleanEmail,
        phone || null,
        hashedPassword,
        role,
        grade,
        cleanDesignation,
        department,
        reporting_manager_id || null,
        req.user.id
      ]
    );

    const newEmployeeId = result.insertId;

    // Insert leave balance for current year
    await db.query(
      "INSERT INTO leave_balance (employee_id, year) VALUES (?, YEAR(CURDATE()))",
      [newEmployeeId]
    );

    return res.status(201).json({
      message: "Employee created successfully",
      employee_code: employeeCode,
      employee_id: newEmployeeId
    });

  } catch (err) {
    console.error("Create Employee Error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// =================ALL EMPLOYEES===================

export const getAllEmployees = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        e.id,
        e.employee_code,
        e.name,
        e.email,
        e.phone,
        e.role,
        e.grade,
        e.designation,
        e.department,
        e.reporting_manager_id,
        rm.name AS reporting_manager_name,   -- ⭐ JOIN to show RM name
        e.status,
        e.created_at
      FROM employees e
      LEFT JOIN employees rm
        ON e.reporting_manager_id = rm.id
      ORDER BY e.id DESC`
    );

    return res.json({
      success: true,
      total: rows.length,
      employees: rows
    });

  } catch (err) {
    console.error("Get All Employees Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
