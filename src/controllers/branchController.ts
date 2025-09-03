import { Request, Response } from "express";
import { AppError } from "../samples/errorHandler";
import prisma from "../database/db";

export async function createBranch(req: Request, res: Response) {
  try {
    const { name } = req.body;

    if (!name) throw new AppError("Branch name is required", 400);

    const existingBranch = await prisma.branch.findFirst({
      where: { 
        name: { equals: name },
        deletedAt: null 
      }
    });

    if (existingBranch) throw new AppError("Branch name already exists", 409);

    const branch = await prisma.branch.create({
      data: { name },
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    });

    res.status(201).json({ success: true, data: branch });
  } catch (error) {
    throw error;
  }
}

export async function getAllBranches(req: Request, res: Response) {
  try {
    const { search } = req.query;
    
    const where: any = { deletedAt: null };
    
    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' };
    }

    const branches = await prisma.branch.findMany({
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
  } catch (error) {
    throw new AppError("Failed to fetch branches", 500);
  }
}

export async function getBranchById(req: Request, res: Response) {
  try {
    const branch = await prisma.branch.findUnique({
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

    if (!branch) throw new AppError("Branch not found", 404);
    
    res.json({ success: true, data: branch });
  } catch (error) {
    throw error;
  }
}

export async function updateBranch(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) throw new AppError("Branch name is required", 400);

    const branch = await prisma.branch.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!branch) throw new AppError("Branch not found", 404);

    if (name !== branch.name) {
      const existingBranch = await prisma.branch.findFirst({
        where: { 
          name: { equals: name },
          deletedAt: null 
        }
      });
      if (existingBranch) throw new AppError("Branch name already exists", 409);
    }

    const updatedBranch = await prisma.branch.update({
      where: { id: parseInt(id) },
      data: { name },
      select: {
        id: true,
        name: true,
        updatedAt: true
      }
    });

    res.json({ success: true, data: updatedBranch });
  } catch (error) {
    throw error;
  }
}

export async function deleteBranch(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const branch = await prisma.branch.findUnique({
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
    
    if (!branch) throw new AppError("Branch not found", 404);

    if (branch._count.products > 0 || branch._count.employees > 0) {
      throw new AppError("Cannot delete branch with associated products or employees", 400);
    }

    await prisma.branch.update({
      where: { id: parseInt(id) },
      data: { deletedAt: new Date() }
    });

    res.json({ success: true, message: "Branch deleted successfully" });
  } catch (error) {
    throw error;
  }
}