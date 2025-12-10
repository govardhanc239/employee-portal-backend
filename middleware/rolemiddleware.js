export const allowHRGrades = (allowedGrades = [],allowedRoles = []) => {
    return (req, res, next) => {
        const userDepartment = req.user?.department;
        const userGrade = req.user?.grade;
        // const userRole = req.user?.role;
        // Must belong to HR department
        if (userDepartment !== "HR") {
            return res.status(403).json({ message: "Access denied. Only HR department allowed." });
        }

        // Must have allowed grade
        if (!allowedGrades.includes(userGrade)) {
            return res.status(403).json({ 
                message: `Access denied. Required grades: ${allowedGrades.join(", ")}` 
            });
        }

        next(); // Access granted
    };
};
