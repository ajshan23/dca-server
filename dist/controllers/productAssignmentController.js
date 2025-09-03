"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignProduct = assignProduct;
exports.returnProduct = returnProduct;
exports.getActiveAssignments = getActiveAssignments;
exports.getAssignmentHistory = getAssignmentHistory;
exports.getEmployeeAssignments = getEmployeeAssignments;
exports.updateAssignment = updateAssignment;
exports.getProductAssignments = getProductAssignments;
exports.getAssignmentAnalytics = getAssignmentAnalytics;
const errorHandler_1 = require("../samples/errorHandler");
const db_1 = __importDefault(require("../database/db"));
const client_1 = require("@prisma/client");
async function assignProduct(req, res) {
    const { productId, employeeId, inventoryId, expectedReturnAt, notes, autoSelect = true } = req.body;
    const assignedById = req.user?.userId;
    // Validate required fields
    if (!assignedById) {
        res.status(401).json({ success: false, message: "Authentication required" });
        return;
    }
    if (!productId || !employeeId) {
        res.status(400).json({ success: false, message: "Product ID and Employee ID are required" });
        return;
    }
    try {
        // Use transaction to ensure data consistency
        const result = await db_1.default.$transaction(async (tx) => {
            // Verify product exists and is not deleted
            const product = await tx.product.findFirst({
                where: { id: productId, deletedAt: null }
            });
            if (!product) {
                throw new errorHandler_1.AppError("Product not found or is deleted", 404);
            }
            // Verify employee exists and is not deleted
            const employee = await tx.employee.findFirst({
                where: { id: employeeId, deletedAt: null }
            });
            if (!employee) {
                throw new errorHandler_1.AppError("Employee not found or is deleted", 404);
            }
            let selectedInventory;
            if (inventoryId) {
                // Specific inventory item requested
                selectedInventory = await tx.productInventory.findFirst({
                    where: {
                        id: inventoryId,
                        productId,
                        status: 'AVAILABLE',
                        deletedAt: null
                    }
                });
                if (!selectedInventory) {
                    throw new errorHandler_1.AppError("Specified inventory item not available for assignment", 400);
                }
            }
            else if (autoSelect) {
                // Auto-select available inventory (FIFO - First In, First Out)
                selectedInventory = await tx.productInventory.findFirst({
                    where: {
                        productId,
                        status: 'AVAILABLE',
                        deletedAt: null
                    },
                    orderBy: { createdAt: 'asc' }
                });
                if (!selectedInventory) {
                    throw new errorHandler_1.AppError("No inventory available for assignment", 400);
                }
            }
            else {
                throw new errorHandler_1.AppError("Either specify inventoryId or set autoSelect to true", 400);
            }
            // Validate expected return date if provided
            if (expectedReturnAt && new Date(expectedReturnAt) < new Date()) {
                throw new errorHandler_1.AppError("Expected return date cannot be in the past", 400);
            }
            // Update inventory status to ASSIGNED
            await tx.productInventory.update({
                where: { id: selectedInventory.id },
                data: { status: 'ASSIGNED' }
            });
            // Create new assignment
            const assignment = await tx.productAssignment.create({
                data: {
                    productId,
                    inventoryId: selectedInventory.id,
                    employeeId,
                    assignedById: parseInt(assignedById),
                    expectedReturnAt: expectedReturnAt ? new Date(expectedReturnAt) : null,
                    notes,
                    status: "ASSIGNED"
                },
                include: {
                    product: {
                        include: {
                            category: true,
                            branch: true
                        }
                    },
                    inventory: true,
                    employee: true,
                    assignedBy: true
                }
            });
            // Create stock transaction record
            await tx.stockTransaction.create({
                data: {
                    inventoryId: selectedInventory.id,
                    type: "OUT",
                    quantity: 1,
                    reason: `Assigned to ${employee.name} (${employee.empId})`,
                    reference: `ASSIGN-${assignment.id}`,
                    userId: parseInt(assignedById)
                }
            });
            return assignment;
        });
        res.status(201).json({ success: true, data: result });
        return;
    }
    catch (error) {
        console.error('Assignment error:', error);
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                res.status(400).json({
                    success: false,
                    message: "Assignment conflict - this inventory item is already assigned"
                });
                return;
            }
            if (error.code === 'P2003') {
                res.status(400).json({
                    success: false,
                    message: "Invalid ID provided - product, inventory, or employee doesn't exist"
                });
                return;
            }
        }
        if (error instanceof errorHandler_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Failed to assign product",
            error: error instanceof Error ? error.message : undefined
        });
        return;
    }
}
async function returnProduct(req, res) {
    const { assignmentId } = req.params;
    const { condition, notes, inventoryStatus = 'AVAILABLE' } = req.body;
    const returnedById = req.user?.userId;
    try {
        const assignment = await db_1.default.productAssignment.findUnique({
            where: { id: parseInt(assignmentId) },
            include: {
                product: true,
                inventory: true,
                employee: true
            }
        });
        if (!assignment) {
            res.status(404).json({ success: false, message: "Assignment not found" });
            return;
        }
        if (assignment.returnedAt) {
            res.status(400).json({ success: false, message: "Product already returned" });
            return;
        }
        const result = await db_1.default.$transaction(async (tx) => {
            // Update assignment as returned
            const updatedAssignment = await tx.productAssignment.update({
                where: { id: parseInt(assignmentId) },
                data: {
                    status: "RETURNED",
                    returnedAt: new Date(),
                    returnCondition: condition || null,
                    notes: notes || `Returned by ${req.user?.username}`
                },
                include: {
                    product: true,
                    inventory: true,
                    employee: true,
                    assignedBy: true
                }
            });
            // Update inventory status
            const newInventoryStatus = inventoryStatus === 'DAMAGED' ? 'DAMAGED' :
                inventoryStatus === 'MAINTENANCE' ? 'MAINTENANCE' : 'AVAILABLE';
            await tx.productInventory.update({
                where: { id: assignment.inventoryId },
                data: {
                    status: newInventoryStatus,
                    condition: condition || assignment.inventory.condition
                }
            });
            // Create stock transaction record
            await tx.stockTransaction.create({
                data: {
                    inventoryId: assignment.inventoryId,
                    type: "IN",
                    quantity: 1,
                    reason: `Returned by ${assignment.employee.name} - Status: ${newInventoryStatus}`,
                    reference: `RETURN-${assignmentId}`,
                    userId: returnedById ? parseInt(returnedById) : undefined
                }
            });
            return updatedAssignment;
        });
        res.json({
            success: true,
            data: result,
            message: "Product returned successfully"
        });
        return;
    }
    catch (error) {
        console.error('Return error:', error);
        res.status(500).json({
            success: false,
            message: "Failed to return product",
            error: error instanceof Error ? error.message : undefined
        });
        return;
    }
}
async function getActiveAssignments(req, res) {
    try {
        const { page = 1, limit = 10, search, employeeId, productId, overdue } = req.query;
        const pageNumber = Number(page);
        const limitNumber = Number(limit);
        const where = {
            returnedAt: null,
            status: 'ASSIGNED'
        };
        if (employeeId)
            where.employeeId = parseInt(employeeId);
        if (productId)
            where.productId = parseInt(productId);
        if (search) {
            where.OR = [
                { product: { name: { contains: search, mode: 'insensitive' } } },
                { product: { model: { contains: search, mode: 'insensitive' } } },
                { employee: { name: { contains: search, mode: 'insensitive' } } },
                { inventory: { serialNumber: { contains: search, mode: 'insensitive' } } }
            ];
        }
        if (overdue === 'true') {
            where.expectedReturnAt = {
                lt: new Date()
            };
        }
        const [assignments, total] = await db_1.default.$transaction([
            db_1.default.productAssignment.findMany({
                where,
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            model: true,
                            category: true,
                            branch: true
                        }
                    },
                    inventory: {
                        select: {
                            id: true,
                            serialNumber: true,
                            condition: true
                        }
                    },
                    employee: {
                        select: {
                            id: true,
                            name: true,
                            empId: true
                        }
                    },
                    assignedBy: {
                        select: {
                            id: true,
                            username: true
                        }
                    }
                },
                orderBy: {
                    assignedAt: 'desc'
                },
                skip: (pageNumber - 1) * limitNumber,
                take: limitNumber
            }),
            db_1.default.productAssignment.count({ where })
        ]);
        // Add overdue status to each assignment
        const assignmentsWithStatus = assignments.map(assignment => ({
            ...assignment,
            isOverdue: assignment.expectedReturnAt ? new Date() > assignment.expectedReturnAt : false,
            daysOverdue: assignment.expectedReturnAt ?
                Math.max(0, Math.floor((Date.now() - assignment.expectedReturnAt.getTime()) / (1000 * 60 * 60 * 24))) : 0
        }));
        res.json({
            success: true,
            data: assignmentsWithStatus,
            pagination: {
                total,
                page: pageNumber,
                limit: limitNumber,
                totalPages: Math.ceil(total / limitNumber)
            }
        });
    }
    catch (error) {
        console.error('Error fetching active assignments:', error);
        throw new errorHandler_1.AppError("Failed to fetch active assignments", 500);
    }
}
async function getAssignmentHistory(req, res) {
    try {
        const { page = 1, limit = 10, fromDate, toDate, employeeId, productId } = req.query;
        const pageNumber = Number(page);
        const limitNumber = Number(limit);
        const where = {
            returnedAt: { not: null }
        };
        if (employeeId)
            where.employeeId = parseInt(employeeId);
        if (productId)
            where.productId = parseInt(productId);
        if (fromDate || toDate) {
            where.assignedAt = {};
            if (fromDate)
                where.assignedAt.gte = new Date(fromDate);
            if (toDate)
                where.assignedAt.lte = new Date(toDate);
        }
        const [assignments, total] = await db_1.default.$transaction([
            db_1.default.productAssignment.findMany({
                where,
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            model: true,
                            category: true,
                            branch: true
                        }
                    },
                    inventory: {
                        select: {
                            id: true,
                            serialNumber: true,
                            condition: true
                        }
                    },
                    employee: {
                        select: {
                            id: true,
                            name: true,
                            empId: true
                        }
                    },
                    assignedBy: {
                        select: {
                            id: true,
                            username: true
                        }
                    }
                },
                orderBy: {
                    returnedAt: 'desc'
                },
                skip: (pageNumber - 1) * limitNumber,
                take: limitNumber
            }),
            db_1.default.productAssignment.count({ where })
        ]);
        // Calculate assignment duration for each record
        const assignmentsWithDuration = assignments.map(assignment => {
            const assignedDate = new Date(assignment.assignedAt);
            const returnedDate = assignment.returnedAt ? new Date(assignment.returnedAt) : new Date();
            const durationDays = Math.floor((returnedDate.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24));
            return {
                ...assignment,
                durationDays,
                // Fixed: Check both returnedAt and expectedReturnAt for null before comparison
                wasOverdue: assignment.expectedReturnAt && assignment.returnedAt ?
                    new Date(assignment.returnedAt) > new Date(assignment.expectedReturnAt) : false
            };
        });
        res.json({
            success: true,
            data: assignmentsWithDuration,
            pagination: {
                total,
                page: pageNumber,
                limit: limitNumber,
                totalPages: Math.ceil(total / limitNumber)
            }
        });
    }
    catch (error) {
        console.error('Error fetching assignment history:', error);
        throw new errorHandler_1.AppError("Failed to fetch assignment history", 500);
    }
}
async function getEmployeeAssignments(req, res) {
    try {
        const { employeeId } = req.params;
        const { active = 'true' } = req.query;
        const where = {
            employeeId: parseInt(employeeId)
        };
        if (active === 'true') {
            where.returnedAt = null;
        }
        const assignments = await db_1.default.productAssignment.findMany({
            where,
            include: {
                product: {
                    include: {
                        category: true,
                        branch: true
                    }
                },
                inventory: {
                    select: {
                        id: true,
                        serialNumber: true,
                        condition: true
                    }
                },
                assignedBy: {
                    select: {
                        username: true
                    }
                }
            },
            orderBy: {
                assignedAt: "desc"
            }
        });
        // Add status information
        const assignmentsWithStatus = assignments.map(assignment => ({
            ...assignment,
            isOverdue: assignment.expectedReturnAt && !assignment.returnedAt ?
                new Date() > assignment.expectedReturnAt : false,
            status: assignment.returnedAt ? 'RETURNED' :
                (assignment.expectedReturnAt && new Date() > assignment.expectedReturnAt) ? 'OVERDUE' : 'ASSIGNED'
        }));
        res.json({ success: true, data: assignmentsWithStatus });
    }
    catch (error) {
        throw new errorHandler_1.AppError("Failed to fetch employee assignments", 500);
    }
}
async function updateAssignment(req, res) {
    try {
        const { assignmentId } = req.params;
        const { expectedReturnAt, notes } = req.body;
        const assignment = await db_1.default.productAssignment.findUnique({
            where: { id: parseInt(assignmentId) }
        });
        if (!assignment)
            throw new errorHandler_1.AppError("Assignment not found", 404);
        if (assignment.status === "RETURNED") {
            throw new errorHandler_1.AppError("Cannot modify returned assignments", 400);
        }
        const updatedAssignment = await db_1.default.productAssignment.update({
            where: { id: parseInt(assignmentId) },
            data: {
                expectedReturnAt: expectedReturnAt ? new Date(expectedReturnAt) : null,
                notes
            },
            include: {
                product: true,
                inventory: true,
                employee: true,
                assignedBy: true
            }
        });
        res.json({ success: true, data: updatedAssignment });
    }
    catch (error) {
        throw error;
    }
}
async function getProductAssignments(req, res) {
    const { productId } = req.params;
    if (!productId) {
        res.status(400).json({
            success: false,
            message: "Product ID is required"
        });
        return;
    }
    try {
        const assignments = await db_1.default.productAssignment.findMany({
            where: {
                productId: parseInt(productId)
            },
            include: {
                product: {
                    include: {
                        category: true,
                        branch: true
                    }
                },
                inventory: {
                    select: {
                        id: true,
                        serialNumber: true,
                        condition: true
                    }
                },
                employee: true,
                assignedBy: true
            },
            orderBy: {
                assignedAt: "desc"
            }
        });
        if (!assignments || assignments.length === 0) {
            res.status(404).json({
                success: false,
                message: "No assignments found for this product"
            });
            return;
        }
        res.json({
            success: true,
            data: assignments
        });
        return;
    }
    catch (error) {
        console.error('Error fetching product assignments:', error);
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            res.status(400).json({
                success: false,
                message: "Invalid product ID format"
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Failed to fetch product assignments",
            error: undefined
        });
        return;
    }
}
// New function to get assignment analytics
async function getAssignmentAnalytics(req, res) {
    try {
        const { fromDate, toDate } = req.query;
        const dateFilter = {};
        if (fromDate)
            dateFilter.gte = new Date(fromDate);
        if (toDate)
            dateFilter.lte = new Date(toDate);
        const analytics = await db_1.default.$transaction(async (tx) => {
            // Total assignments in period
            const totalAssignments = await tx.productAssignment.count({
                where: fromDate || toDate ? { assignedAt: dateFilter } : undefined
            });
            // Active assignments
            const activeAssignments = await tx.productAssignment.count({
                where: { returnedAt: null }
            });
            // Overdue assignments
            const overdueAssignments = await tx.productAssignment.count({
                where: {
                    returnedAt: null,
                    expectedReturnAt: { lt: new Date() }
                }
            });
            // Top employees by assignment count
            const topEmployees = await tx.productAssignment.groupBy({
                by: ['employeeId'],
                _count: { id: true },
                where: fromDate || toDate ? { assignedAt: dateFilter } : undefined,
                orderBy: { _count: { id: 'desc' } },
                take: 5
            });
            // Most assigned products
            const topProducts = await tx.productAssignment.groupBy({
                by: ['productId'],
                _count: { id: true },
                where: fromDate || toDate ? { assignedAt: dateFilter } : undefined,
                orderBy: { _count: { id: 'desc' } },
                take: 5
            });
            return {
                totalAssignments,
                activeAssignments,
                overdueAssignments,
                returnRate: totalAssignments > 0 ?
                    ((totalAssignments - activeAssignments) / totalAssignments * 100).toFixed(2) : '0',
                topEmployees: topEmployees.map(e => ({ employeeId: e.employeeId, count: e._count.id })),
                topProducts: topProducts.map(p => ({ productId: p.productId, count: p._count.id }))
            };
        });
        res.json({ success: true, data: analytics });
    }
    catch (error) {
        throw new errorHandler_1.AppError("Failed to fetch assignment analytics", 500);
    }
}
//# sourceMappingURL=productAssignmentController.js.map