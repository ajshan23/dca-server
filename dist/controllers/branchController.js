"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBranch = createBranch;
exports.getAllBranches = getAllBranches;
exports.getBranchById = getBranchById;
exports.updateBranch = updateBranch;
exports.deleteBranch = deleteBranch;
const errorHandler_1 = require("../samples/errorHandler");
const db_1 = __importDefault(require("../database/db"));
async function createBranch(req, res) {
    try {
        const { name } = req.body;
        if (!name)
            throw new errorHandler_1.AppError("Branch name is required", 400);
        const existingBranch = await db_1.default.branch.findFirst({
            where: {
                name: { equals: name },
                deletedAt: null
            }
        });
        if (existingBranch)
            throw new errorHandler_1.AppError("Branch name already exists", 409);
        const branch = await db_1.default.branch.create({
            data: { name },
            select: {
                id: true,
                name: true,
                createdAt: true
            }
        });
        res.status(201).json({ success: true, data: branch });
    }
    catch (error) {
        throw error;
    }
}
async function getAllBranches(req, res) {
    try {
        const { search } = req.query;
        const where = { deletedAt: null };
        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }
        const branches = await db_1.default.branch.findMany({
            where,
            select: {
                id: true,
                name: true,
                createdAt: true,
                _count: {
                    select: {
                        products: true,
                        employees: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });
        res.json({ success: true, data: branches });
    }
    catch (error) {
        throw new errorHandler_1.AppError("Failed to fetch branches", 500);
    }
}
async function getBranchById(req, res) {
    try {
        const branch = await db_1.default.branch.findUnique({
            where: { id: parseInt(req.params.id) },
            select: {
                id: true,
                name: true,
                createdAt: true,
                updatedAt: true,
                products: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                employees: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        if (!branch)
            throw new errorHandler_1.AppError("Branch not found", 404);
        res.json({ success: true, data: branch });
    }
    catch (error) {
        throw error;
    }
}
async function updateBranch(req, res) {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name)
            throw new errorHandler_1.AppError("Branch name is required", 400);
        const branch = await db_1.default.branch.findUnique({
            where: { id: parseInt(id) }
        });
        if (!branch)
            throw new errorHandler_1.AppError("Branch not found", 404);
        if (name !== branch.name) {
            const existingBranch = await db_1.default.branch.findFirst({
                where: {
                    name: { equals: name },
                    deletedAt: null
                }
            });
            if (existingBranch)
                throw new errorHandler_1.AppError("Branch name already exists", 409);
        }
        const updatedBranch = await db_1.default.branch.update({
            where: { id: parseInt(id) },
            data: { name },
            select: {
                id: true,
                name: true,
                updatedAt: true
            }
        });
        res.json({ success: true, data: updatedBranch });
    }
    catch (error) {
        throw error;
    }
}
async function deleteBranch(req, res) {
    try {
        const { id } = req.params;
        const branch = await db_1.default.branch.findUnique({
            where: { id: parseInt(id) },
            include: {
                _count: {
                    select: {
                        products: true,
                        employees: true
                    }
                }
            }
        });
        if (!branch)
            throw new errorHandler_1.AppError("Branch not found", 404);
        if (branch._count.products > 0 || branch._count.employees > 0) {
            throw new errorHandler_1.AppError("Cannot delete branch with associated products or employees", 400);
        }
        await db_1.default.branch.update({
            where: { id: parseInt(id) },
            data: { deletedAt: new Date() }
        });
        res.json({ success: true, message: "Branch deleted successfully" });
    }
    catch (error) {
        throw error;
    }
}
//# sourceMappingURL=branchController.js.map