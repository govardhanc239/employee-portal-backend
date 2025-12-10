import cron from "node-cron";
import { db } from "../config/db.js";

// ==================Auto Clock Out==========================

cron.schedule("*/30 * * * *", async () => {
  console.log("[CRON] Checking for auto clock-outs...");

  try {
    // Find sessions older than 12 hours that are still open
    const [rows] = await db.query(`
      SELECT * FROM attendance_sessions
      WHERE clock_out IS NULL
      AND TIMESTAMPDIFF(HOUR, clock_in, NOW()) >= 12
    `);

    for (const s of rows) {
      const clockInTime = new Date(s.clock_in);
      const finalClockOut = new Date(clockInTime.getTime() + 12 * 60 * 60 * 1000);
      const duration = 12;

      await db.query(
        "UPDATE attendance_sessions SET clock_out = ?, duration = ?, is_auto_clockout = 1 WHERE id = ?",
        [finalClockOut, duration, s.id]
      );

      await db.query(
        "UPDATE attendance_days SET total_hours = total_hours + 12 WHERE id = ?",
        [s.day_id]
      );

      console.log(
        `[CRON] Auto clock-out applied to session ${s.id} (12 hours)`
      );
    }
  } catch (err) {
    console.error("CRON Auto Clock-out Error:", err);
  }
});