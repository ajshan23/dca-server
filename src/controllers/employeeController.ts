import { Request, Response } from "express";
import { AppError } from "../samples/errorHandler";
import prisma from "../database/db";

export async function createEmployee(req: Request, res: Response) {
  try {
    const { empId, name, email, department, position, branchId } = req.body;

    if (!empId || !name) throw new AppError("Employee ID and name are required", 400);

    // Check for existing employee ID
    const existingEmp = await prisma.employee.findFirst({
      where: { 
        empId: { equals: empId },
        deletedAt: null 
      }
    });
    if (existingEmp) throw new AppError("Employee ID already exists", 409);

    // Validate branch if provided
    if (branchId) {
      const branchExists = await prisma.branch.findFirst({
        where: { id: branchId, deletedAt: null }
      });
      if (!branchExists) throw new AppError("Branch not found", 404);
    }

    const employee = await prisma.employee.create({
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
  } catch (error) {
    throw error;
  }
}

export async function getAllEmployees(req: Request, res: Response) {
  try {
    const { search, branchId, department } = req.query;
    
    const where: any = { deletedAt: null };
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { empId: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (branchId) where.branchId = parseInt(branchId as string);
    if (department) where.department = { contains: department as string, mode: 'insensitive' };

    const employees = await prisma.employee.findMany({
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
  } catch (error) {
    throw new AppError("Failed to fetch employees", 500);
  }
}

export async function getEmployeeById(req: Request, res: Response) {
  try {
    const employee = await prisma.employee.findUnique({
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

    if (!employee) throw new AppError("Employee not found", 404);
    
    res.json({ success: true, data: employee });
  } catch (error) {
    throw error;
  }
}

export async function updateEmployee(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { empId, name, email, department, position, branchId } = req.body;

    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!employee) throw new AppError("Employee not found", 404);

    // Validate branch if provided
    if (branchId) {
      const branchExists = await prisma.branch.findFirst({
        where: { id: branchId, deletedAt: null }
      });
      if (!branchExists) throw new AppError("Branch not found", 404);
    }

    const updateData: any = {
      name: name || employee.name,
      email: email || employee.email,
      department: department || employee.department,
      position: position || employee.position,
      branchId: branchId || employee.branchId
    };

    // Check for empId conflict if changed
    if (empId && empId !== employee.empId) {
      const existingEmp = await prisma.employee.findFirst({
        where: { 
          empId: { equals: empId },
          deletedAt: null 
        }
      });
      if (existingEmp) throw new AppError("Employee ID already exists", 409);
      updateData.empId = empId;
    }

    const updatedEmployee = await prisma.employee.update({
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
  } catch (error) {
    throw error;
  }
}

export async function deleteEmployee(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findUnique({
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
    
    if (!employee) throw new AppError("Employee not found", 404);

    if (employee._count.assignments > 0) {
      throw new AppError("Cannot delete employee with active assignments", 400);
    }

    await prisma.employee.update({
      where: { id: parseInt(id) },
      data: { deletedAt: new Date() }
    });

    res.json({ success: true, message: "Employee deleted successfully" });
  } catch (error) {
    throw error;
  }
}