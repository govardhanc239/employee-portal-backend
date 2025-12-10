export const validateCreateEmployee = (req, res, next) => {
    const { name, email, phone, role, grade,designation, department, password } = req.body;

    // Trim all fields
    req.body.name = name?.trim();
    req.body.email = email?.trim().toLowerCase();
    req.body.phone = phone?.trim();
    req.body.password = password?.trim();

    const validRoles = ["employee", "hr"];
    const validGrades = ["MT","M1","M2","M3","M4","L1","L2"];
    const validDepartments = ["SAP","DT","DA","IQE","PMO","HR"];

    // Name validation
    if (!req.body.name || req.body.name.length < 3) {
        return res.status(400).json({ message: "Invalid name" });
    }

    // Email validation (regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(req.body.email)) {
        return res.status(400).json({ message: "Invalid email format" });
    }

    // Phone validation (optional)
    const phoneRegex = /^[0-9]{10}$/;
    if (phone && !phoneRegex.test(phone)) {
        return res.status(400).json({ message: "Invalid phone number" });
    }

    // Role validation
    if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
    }

    // Grade validation
    if (!validGrades.includes(grade)) {
        return res.status(400).json({ message: "Invalid grade" });
    }

    if (!designation || designation.length < 2) {
   return res.status(400).json({ message: "Invalid designation" });
}


    // Department validation
    if (!validDepartments.includes(department)) {
        return res.status(400).json({ message: "Invalid department" });
    }

    // Password validation
    const passRegex =
        /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,20}$/;

    if (!passRegex.test(password)) {
        return res.status(400).json({
            message:
                "Password must contain 8–20 chars, uppercase, lowercase, number, and symbol"
        });
    }

    next();
};
