"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCategory = createCategory;
exports.getAllCategories = getAllCategories;
exports.getCategoryById = getCategoryById;
exports.updateCategory = updateCategory;
exports.deleteCategory = deleteCategory;
const errorHandler_1 = require("../samples/errorHandler");
const db_1 = __importDefault(require("../database/db"));
async function createCategory(req, res) {
    try {
        const { name, description } = req.body;
        if (!name)
            throw new errorHandler_1.AppError("Category name is required", 400);
        const existingCategory = await db_1.default.category.findFirst({
            where: {
                name: { equals: name },
                deletedAt: null
            }
        });
        if (existingCategory)
            throw new errorHandler_1.AppError("Category name already exists", 409);
        const category = await db_1.default.category.create({
            data: { name, description },
            select: {
                id: true,
                name: true,
                description: true,
                createdAt: true
            }
        });
        res.status(201).json({ success: true, data: category });
    }
    catch (error) {
        throw error;
    }
}
async function getAllCategories(req, res) {
    try {
        const { search } = req.query;
        const where = { deletedAt: null };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }
        const categories = await db_1.default.category.findMany({
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
        res.json({ success: true, data: categories });
    }
    catch (error) {
        throw new errorHandler_1.AppError("Failed to fetch categories", 500);
    }
}
async function getCategoryById(req, res) {
    try {
        const category = await db_1.default.category.findUnique({
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
                        name: true
                    }
                }
            }
        });
        if (!category)
            throw new errorHandler_1.AppError("Category not found", 404);
        res.json({ success: true, data: category });
    }
    catch (error) {
        throw error;
    }
}
async function updateCategory(req, res) {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        if (!name)
            throw new errorHandler_1.AppError("Category name is required", 400);
        const category = await db_1.default.category.findUnique({
            where: { id: parseInt(id) }
        });
        if (!category)
            throw new errorHandler_1.AppError("Category not found", 404);
        if (name !== category.name) {
            const existingCategory = await db_1.default.category.findFirst({
                where: {
                    name: { equals: name },
                    deletedAt: null
                }
            });
            if (existingCategory)
                throw new errorHandler_1.AppError("Category name already exists", 409);
        }
        const updatedCategory = await db_1.default.category.update({
            where: { id: parseInt(id) },
            data: { name, description },
            select: {
                id: true,
                name: true,
                description: true,
                updatedAt: true
            }
        });
        res.json({ success: true, data: updatedCategory });
    }
    catch (error) {
        throw error;
    }
}
async function deleteCategory(req, res) {
    try {
        const { id } = req.params;
        const category = await db_1.default.category.findUnique({
            where: { id: parseInt(id) },
            include: {
                _count: {
                    select: {
                        products: true
                    }
                }
            }
        });
        if (!category)
            throw new errorHandler_1.AppError("Category not found", 404);
        if (category._count.products > 0) {
            throw new errorHandler_1.AppError("Cannot delete category with associated products", 400);
        }
        await db_1.default.category.update({
            where: { id: parseInt(id) },
            data: { deletedAt: new Date() }
        });
        res.json({ success: true, message: "Category deleted successfully" });
    }
    catch (error) {
        throw error;
    }
}
//# sourceMappingURL=categoryController.js.map