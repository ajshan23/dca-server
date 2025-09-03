"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const config_1 = __importDefault(require("../config"));
const prisma = new client_1.PrismaClient({
    log: config_1.default.db.logging ? ["query", "info", "warn", "error"] : ["warn", "error"],
    datasources: {
        db: {
            url: config_1.default.db.url
        }
    }
});
// Soft delete middleware
prisma.$use(async (params, next) => {
    // Check incoming query type
    if (params.action === 'delete') {
        // Delete queries
        // Change action to an update
        params.action = 'update';
        params.args.data = { deletedAt: new Date() };
    }
    if (params.action === 'deleteMany') {
        // Delete many queries
        params.action = 'updateMany';
        if (params.args.data !== undefined) {
            params.args.data.deletedAt = new Date();
        }
        else {
            params.args.data = { deletedAt: new Date() };
        }
    }
    // Filter out deleted records for find methods
    if (params.action === 'findUnique' || params.action === 'findFirst') {
        // Add filter for deletedAt
        params.args.where.deletedAt = null;
    }
    if (params.action === 'findMany') {
        // Find many queries
        if (params.args.where) {
            if (params.args.where.deletedAt === undefined) {
                // Exclude deleted records if they haven't been explicitly requested
                params.args.where.deletedAt = null;
            }
        }
        else {
            params.args.where = { deletedAt: null };
        }
    }
    return next(params);
});
exports.default = prisma;
//# sourceMappingURL=db.js.map