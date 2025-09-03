"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const config = {
    env: process.env.NODE_ENV || "development",
    port: parseInt(process.env.PORT || "3001"),
    jwtSecret: process.env.JWT_SECRET || "your-secret-key",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
    cors: {
        origin: process.env.CORS_ORIGIN?.split(",") || "*",
        credentials: process.env.CORS_CREDENTIALS === "true"
    },
    db: {
        url: process.env.DATABASE_URL || "",
        logging: process.env.DB_LOGGING === "true"
    }
};
exports.default = config;
//# sourceMappingURL=config.js.map