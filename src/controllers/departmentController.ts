import { Request, Response } from "express";
import { AppError } from "../samples/errorHandler";
import prisma from "../database/db";

export async function createDepartment(req: Request, res: Response) {
  try {
    const { name, description } = req.body;

    if (!name) throw new AppError("Department name is required", 400);

    const existingDept = await prisma.department.findFirst({
      where: { 
        name: { equals: name },
        deletedAt: null 
      }
    });

    if (existingDept) throw new AppError("Department already exists", 409);

    const department = await prisma.department.create({
      data: { name, description },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true
      }
    });

    res.status(201).json({ success: true, data: department });
  } catch (error) {
    throw error;
  }
}

export async function getAllDepartments(req: Request, res: Response) {
  try {
    const { search } = req.query;
    
    const where: any = { deletedAt: null };
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const departments = await prisma.department.findMany({
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
  } catch (error) {
    throw new AppError("Failed to fetch departments", 500);
  }
}

export async function getDepartmentById(req: Request, res: Response) {
  try {
    const department = await prisma.department.findUnique({
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

    if (!department) throw new AppError("Department not found", 404);
    
    res.json({ success: true, data: department });
  } catch (error) {
    throw error;
  }
}

export async function updateDepartment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) throw new AppError("Department name is required", 400);

    const department = await prisma.department.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!department) throw new AppError("Department not found", 404);

    if (name !== department.name) {
      const existingDept = await prisma.department.findFirst({
        where: { 
          name: { equals: name },
          deletedAt: null 
        }
      });
      if (existingDept) throw new AppError("Department name already exists", 409);
    }

    const updatedDepartment = await prisma.department.update({
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
  } catch (error) {
    throw error;
  }
}

export async function deleteDepartment(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const department = await prisma.department.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    });
    
    if (!department) throw new AppError("Department not found", 404);

    if (department._count.products > 0) {
      throw new AppError("Cannot delete department with associated products", 400);
    }

    await prisma.department.update({
      where: { id: parseInt(id) },
      data: { deletedAt: new Date() }
    });

    res.json({ success: true, message: "Department deleted successfully" });
  } catch (error) {
    throw error;
  }
}