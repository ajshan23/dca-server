import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import config from "./config";
import prisma from "./database/db";
import routes from "./routes";
import { errorHandler } from "./samples/errorHandler";

const app = express();

// For __dirname (since ES modules don’t have it natively)


// Middleware
app.use(helmet()); // Security headers
app.use(cors({ origin: "*", credentials: true })); // CORS configuration
app.use(morgan("dev")); // Request logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Database connection check
async function checkDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully");

    // Optional: Run database migrations
    // await prisma.$executeRaw`PRISMA MIGRATION COMMAND`;
  } catch (error) {
    console.error("❌ Database connection error:", error);
    process.exit(1);
  }
}

app.get("/", (_req, res) => {
  res.send("hi from ajmal");
});

// API Routes
app.use("/api", routes);

// Serve React frontend// Serve static files
// Error handling (must be after routes)
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await checkDatabaseConnection();

    const server = app.listen(4000, () => {
      console.log(`🚀 Server running on port ${config.port} in ${config.env} mode`);
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      console.log("SIGTERM received. Shutting down gracefully...");
      server.close(async () => {
        await prisma.$disconnect();
        console.log("Server closed");
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      console.log("SIGINT received. Shutting down gracefully...");
      server.close(async () => {
        await prisma.$disconnect();
        console.log("Server closed");
        process.exit(0);
      });
    });
  } catch (error) {
    console.error("❌ Server startup error:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
