import mysql from "mysql2";

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "attendance_system",
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
});

export const db = pool.promise();

// Test connection
db.getConnection()
  .then(() => console.log("✅ MySQL Database Connected Successfully"))
  .catch(err => {
    console.log("❌ DB Connection Failed");
    console.log(err);   // <-- SHOW FULL ERROR
  });

