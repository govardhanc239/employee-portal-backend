import { db } from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Fetch user + team count
        const [rows] = await db.query(
            `
            SELECT 
                e.*,
                (SELECT COUNT(*) FROM employees WHERE reporting_manager_id = e.id) AS team_count
            FROM employees e
            WHERE e.email = ? AND e.status = 'active'
            `,
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: "Invalid" });
        }

        const user = rows[0];

        console.log("User fetched for login:", user)

        // Check password

        const isMatch = await bcrypt.compare(password, user.password);
        console.log("password match:", isMatch)
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or pass" });
        }

        // Create token
        const token = jwt.sign(
            {
                id: user.id,
                role: user.role,
                grade: user.grade,
                department: user.department,
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        // LOGIN RESPONSE
        return res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                employee_code: user.employee_code,
                name: user.name,
                email: user.email,
                role: user.role,
                grade: user.grade,
                department: user.department,

                reporting_manager_id: user.reporting_manager_id,
                team_count: user.team_count   // ⭐ ADDED
            }
        });

    } catch (err) {
        console.error("Login Error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
