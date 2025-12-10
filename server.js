import 'dotenv/config'; // Loads env vars immediately
import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import regularizationRoutes from './routes/regularizationRoutes.js'
import leaveRoutes from "./routes/leaveRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import "./cron/autoClockout.js";
import { logger } from "./utils/logger.js";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";


const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(helmet());

app.use(cors({
  origin: ["http://localhost:3000"], // restrict to frontend
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);


// Test route
app.get("/", (req, res) => {
    res.send("Attendance Backend Running 🚀 (ES6 Enabled)");
});


// Routes
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/regularization", regularizationRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/ai", aiRoutes)


logger.info("Server started");

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
