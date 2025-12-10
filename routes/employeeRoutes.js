import express from "express";
import { createEmployee, getAllEmployees } from "../controllers/employeeController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { allowHRGrades } from "../middleware/roleMiddleware.js";
import { validateCreateEmployee } from "../middleware/validationMiddleware.js";


const router = express.Router();
router.post(
  "/all",
  verifyToken,
  allowHRGrades(["M3", "M4", "L1", "L2"]),
  validateCreateEmployee,   // ⬅️ Added here
  getAllEmployees
);

router.post(
  "/create",
  verifyToken,
  allowHRGrades(["M3", "M4", "L1", "L2"]),
  validateCreateEmployee,   // ⬅️ Added here
  createEmployee
);


export default router;
