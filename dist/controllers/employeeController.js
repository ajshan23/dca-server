"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmployee = createEmployee;
exports.getAllEmployees = getAllEmployees;
exports.getEmployeeById = getEmployeeById;
exports.updateEmployee = updateEmployee;
exports.deleteEmployee = deleteEmployee;
const errorHandler_1 = require("../samples/errorHandler");
const db_1 = __importDefault(require("../database/db"));
async function createEmployee(req, res) {
    try {
        const { empId, name, email, department, position, branchId } = req.body;
        if (!empId || !name)
            throw new errorHandler_1.AppError("Employee ID and name are required", 400);
        // Check for existing employee ID
        const existingEmp = await db_1.default.employee.findFirst({
            where: {
                empId: { equals: empId },
                deletedAt: null
            }
        });
        if (existingEmp)
            throw new errorHandler_1.AppError("Employee ID already exists", 409);
        // Validate branch if provided
        if (branchId) {
            const branchExists = await db_1.default.branch.findFirst({
                where: { id: branchId, deletedAt: null }
            });
            if (!branchExists)
                throw new errorHandler_1.AppError("Branch not found", 404);
        }
        const employee = await db_1.default.employee.create({
            data: {
                empId,
                name,
                email,
                department,
                position,
                branchId
            },
            select: {
                id: true,
                empId: true,
                name: true,
                email: true,
                department: true,
                position: true,
                branch: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                createdAt: true
            }
        });
        res.status(201).json({ success: true, data: employee });
    }
    catch (error) {
        throw error;
    }
}
async function getAllEmployees(req, res) {
    try {
        const { search, branchId, department } = req.query;
        const where = { deletedAt: null };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { empId: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (branchId)
            where.branchId = parseInt(branchId);
        if (department)
            where.department = { contains: department, mode: 'insensitive' };
        const employees = await db_1.default.employee.findMany({
            where,
            select: {
                id: true,
                empId: true,
                name: true,
                email: true,
                department: true,
                position: true,
                branch: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                createdAt: true,
                _count: {
                    select: {
                        assignments: {
                            where: {
                                returnedAt: null
                            }
                        }
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });
        res.json({ success: true, data: employees });
    }
    catch (error) {
        throw new errorHandler_1.AppError("Failed to fetch employees", 500);
    }
}
async function getEmployeeById(req, res) {
    try {
        const employee = await db_1.default.employee.findUnique({
            where: { id: parseInt(req.params.id) },
            select: {
                id: true,
                empId: true,
                name: true,
                email: true,
                department: true,
                position: true,
                branch: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                createdAt: true,
                updatedAt: true,
                assignments: {
                    where: {
                        returnedAt: null
                    },
                    select: {
                        id: true,
                        product: {
                            select: {
                                id: true,
                                name: true,
                                model: true
                            }
                        },
                        assignedAt: true
                    }
                }
            }
        });
        if (!employee)
            throw new errorHandler_1.AppError("Employee not found", 404);
        res.json({ success: true, data: employee });
    }
    catch (error) {
        throw error;
    }
}
async function updateEmployee(req, res) {
    try {
        const { id } = req.params;
        const { empId, name, email, department, position, branchId } = req.body;
        const employee = await db_1.default.employee.findUnique({
            where: { id: parseInt(id) }
        });
        if (!employee)
            throw new errorHandler_1.AppError("Employee not found", 404);
        // Validate branch if provided
        if (branchId) {
            const branchExists = await db_1.default.branch.findFirst({
                where: { id: branchId, deletedAt: null }
            });
            if (!branchExists)
                throw new errorHandler_1.AppError("Branch not found", 404);
        }
        const updateData = {
            name: name || employee.name,
            email: email || employee.email,
            department: department || employee.department,
            position: position || employee.position,
            branchId: branchId || employee.branchId
        };
        // Check for empId conflict if changed
        if (empId && empId !== employee.empId) {
            const existingEmp = await db_1.default.employee.findFirst({
                where: {
                    empId: { equals: empId },
                    deletedAt: null
                }
            });
            if (existingEmp)
                throw new errorHandler_1.AppError("Employee ID already exists", 409);
            updateData.empId = empId;
        }
        const updatedEmployee = await db_1.default.employee.update({
            where: { id: parseInt(id) },
            data: updateData,
            select: {
                id: true,
                empId: true,
                name: true,
                email: true,
                department: true,
                position: true,
                branch: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                updatedAt: true
            }
        });
        res.json({ success: true, data: updatedEmployee });
    }
    catch (error) {
        throw error;
    }
}
async function deleteEmployee(req, res) {
    try {
        const { id } = req.params;
        const employee = await db_1.default.employee.findUnique({
            where: { id: parseInt(id) },
            include: {
                _count: {
                    select: {
                        assignments: {
                            where: {
                                returnedAt: null
                            }
                        }
                    }
                }
            }
        });
        if (!employee)
            throw new errorHandler_1.AppError("Employee not found", 404);
        if (employee._count.assignments > 0) {
            throw new errorHandler_1.AppError("Cannot delete employee with active assignments", 400);
        }
        await db_1.default.employee.update({
            where: { id: parseInt(id) },
            data: { deletedAt: new Date() }
        });
        res.json({ success: true, message: "Employee deleted successfully" });
    }
    catch (error) {
        throw error;
    }
}
//# sourceMappingURL=employeeController.js.map