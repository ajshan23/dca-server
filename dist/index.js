"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const config_1 = __importDefault(require("./config"));
const db_1 = __importDefault(require("./database/db"));
const routes_1 = __importDefault(require("./routes"));
const errorHandler_1 = require("./samples/errorHandler");
const app = (0, express_1.default)();
// Middleware
app.use((0, helmet_1.default)()); // Security headers
app.use((0, cors_1.default)({ origin: "*", credentials: true })); // CORS configuration
app.use((0, morgan_1.default)("dev")); // Request logging
app.use(express_1.default.json()); // Parse JSON bodies
app.use(express_1.default.urlencoded({ extended: true })); // Parse URL-encoded bodies
// Database connection check
async function checkDatabaseConnection() {
    try {
        await db_1.default.$connect();
        console.log("✅ Database connected successfully");
        // Optional: Run database migrations
        // await prisma.$executeRaw`PRISMA MIGRATION COMMAND`;
    }
    catch (error) {
        console.error("❌ Database connection error:", error);
        process.exit(1);
    }
}
app.get("/", (_req, res) => {
    res.send("hi from ajmal");
});
// Routes
app.use("/api", routes_1.default);
// Error handling (must be after routes)
app.use(errorHandler_1.errorHandler);
// Start server
async function startServer() {
    try {
        await checkDatabaseConnection();
        const server = app.listen(4000, () => {
            console.log(`🚀 Server running on port ${config_1.default.port} in ${config_1.default.env} mode`);
        });
        // Graceful shutdown
        process.on("SIGTERM", () => {
            console.log("SIGTERM received. Shutting down gracefully...");
            server.close(async () => {
                await db_1.default.$disconnect();
                console.log("Server closed");
                process.exit(0);
            });
        });
        process.on("SIGINT", () => {
            console.log("SIGINT received. Shutting down gracefully...");
            server.close(async () => {
                await db_1.default.$disconnect();
                console.log("Server closed");
                process.exit(0);
            });
        });
    }
    catch (error) {
        console.error("❌ Server startup error:", error);
        await db_1.default.$disconnect();
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=index.js.map