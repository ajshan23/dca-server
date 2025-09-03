"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJWT = authenticateJWT;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errorHandler_1 = require("../samples/errorHandler");
const db_1 = __importDefault(require("../database/db"));
async function authenticateJWT(req, _res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return next(new errorHandler_1.AppError("Authorization header is required", 401));
        }
        const tokenParts = authHeader.split(" ");
        if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
            return next(new errorHandler_1.AppError("Invalid authorization header format", 401));
        }
        const token = tokenParts[1];
        jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                return next(new errorHandler_1.AppError("Invalid or expired token", 403));
            }
            const payload = decoded;
            // 🔎 check user still exists and not deleted
            const user = await db_1.default.user.findUnique({
                where: { id: parseInt(payload.userId) },
                select: { id: true, username: true, role: true, deletedAt: true },
            });
            if (!user || user.deletedAt) {
                return next(new errorHandler_1.AppError("User not found or deleted", 404));
            }
            req.user = {
                userId: String(user.id),
                role: user.role,
                username: user.username,
            };
            return next();
        });
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=authMiddleware.js.map