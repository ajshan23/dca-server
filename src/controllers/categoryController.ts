import { Request, Response } from "express";
import { AppError } from "../samples/errorHandler";
import prisma from "../database/db";

export async function createCategory(req: Request, res: Response) {
  try {
    const { name, description } = req.body;

    if (!name) throw new AppError("Category name is required", 400);

    const existingCategory = await prisma.category.findFirst({
      where: { 
        name: { equals: name},
        deletedAt: null 
      }
    });

    if (existingCategory) throw new AppError("Category name already exists", 409);

    const category = await prisma.category.create({
      data: { name, description },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true
      }
    });

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    throw error;
  }
}

export async function getAllCategories(req: Request, res: Response) {
  try {
    const { search, page = "1", limit = "10" } = req.query;

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { description: { contains: search as string } }
      ];
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const pageSize = parseInt(limit as string, 10) || 10;
    const skip = (pageNum - 1) * pageSize;

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: pageSize,
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
          name: "asc"
        }
      }),
      prisma.category.count({ where })
    ]);

    res.json({
      success: true,
      data: categories,
      total,
      page: pageNum,
      limit: pageSize
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    throw new AppError("Failed to fetch categories", 500);
  }
}
export async function getCategoryById(req: Request, res: Response) {
  try {
    const category = await prisma.category.findUnique({
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

    if (!category) throw new AppError("Category not found", 404);
    
    res.json({ success: true, data: category });
  } catch (error) {
    throw error;
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) throw new AppError("Category name is required", 400);

    const category = await prisma.category.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!category) throw new AppError("Category not found", 404);

    if (name !== category.name) {
      const existingCategory = await prisma.category.findFirst({
        where: { 
          name: { equals: name },
          deletedAt: null 
        }
      });
      if (existingCategory) throw new AppError("Category name already exists", 409);
    }

    const updatedCategory = await prisma.category.update({
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
  } catch (error) {
    throw error;
  }
}

export async function deleteCategory(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    });
    
    if (!category) throw new AppError("Category not found", 404);

    if (category._count.products > 0) {
      throw new AppError("Cannot delete category with associated products", 400);
    }

    await prisma.category.update({
      where: { id: parseInt(id) },
      data: { deletedAt: new Date() }
    });

    res.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    throw error;
  }
}