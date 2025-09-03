"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDepartment = createDepartment;
exports.getAllDepartments = getAllDepartments;
exports.getDepartmentById = getDepartmentById;
exports.updateDepartment = updateDepartment;
exports.deleteDepartment = deleteDepartment;
const errorHandler_1 = require("../samples/errorHandler");
const db_1 = __importDefault(require("../database/db"));
async function createDepartment(req, res) {
    try {
        const { name, description } = req.body;
        if (!name)
            throw new errorHandler_1.AppError("Department name is required", 400);
        const existingDept = await db_1.default.department.findFirst({
            where: {
                name: { equals: name },
                deletedAt: null
            }
        });
        if (existingDept)
            throw new errorHandler_1.AppError("Department already exists", 409);
        const department = await db_1.default.department.create({
            data: { name, description },
            select: {
                id: true,
                name: true,
                description: true,
                createdAt: true
            }
        });
        res.status(201).json({ success: true, data: department });
    }
    catch (error) {
        throw error;
    }
}
async function getAllDepartments(req, res) {
    try {
        const { search } = req.query;
        const where = { deletedAt: null };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }
        const departments = await db_1.default.department.findMany({
            where,
            select: {
                id: true,
                name: true,
                description: true,
                createdAt: true,
                _count: {
                    select: {
                        products: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });
        res.json({ success: true, data: departments });
    }
    catch (error) {
        throw new errorHandler_1.AppError("Failed to fetch departments", 500);
    }
}
async function getDepartmentById(req, res) {
    try {
        const department = await db_1.default.department.findUnique({
            where: { id: parseInt(req.params.id) },
            select: {
                id: true,
                name: true,
                description: true,
                createdAt: true,
                updatedAt: true,
                products: {
                    select: {
                        id: true,
                        name: true,
                        model: true
                    }
                }
            }
        });
        if (!department)
            throw new errorHandler_1.AppError("Department not found", 404);
        res.json({ success: true, data: department });
    }
    catch (error) {
        throw error;
    }
}
async function updateDepartment(req, res) {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        if (!name)
            throw new errorHandler_1.AppError("Department name is required", 400);
        const department = await db_1.default.department.findUnique({
            where: { id: parseInt(id) }
        });
        if (!department)
            throw new errorHandler_1.AppError("Department not found", 404);
        if (name !== department.name) {
            const existingDept = await db_1.default.department.findFirst({
                where: {
                    name: { equals: name },
                    deletedAt: null
                }
            });
            if (existingDept)
                throw new errorHandler_1.AppError("Department name already exists", 409);
        }
        const updatedDepartment = await db_1.default.department.update({
            where: { id: parseInt(id) },
            data: { name, description },
            select: {
                id: true,
                name: true,
                description: true,
                updatedAt: true
            }
        });
        res.json({ success: true, data: updatedDepartment });
    }
    catch (error) {
        throw error;
    }
}
async function deleteDepartment(req, res) {
    try {
        const { id } = req.params;
        const department = await db_1.default.department.findUnique({
            where: { id: parseInt(id) },
            include: {
                _count: {
                    select: {
                        products: true
                    }
                }
            }
        });
        if (!department)
            throw new errorHandler_1.AppError("Department not found", 404);
        if (department._count.products > 0) {
            throw new errorHandler_1.AppError("Cannot delete department with associated products", 400);
        }
        await db_1.default.department.update({
            where: { id: parseInt(id) },
            data: { deletedAt: new Date() }
        });
        res.json({ success: true, message: "Department deleted successfully" });
    }
    catch (error) {
        throw error;
    }
}
//# sourceMappingURL=departmentController.js.map