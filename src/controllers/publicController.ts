// controllers/publicProductController.ts
import { Request, Response } from "express";
import { AppError } from "../samples/errorHandler";
import prisma from "../database/db";

// Get public assignment information for QR code scanning
export async function getPublicAssignmentInfo(req: Request, res: Response) {
  try {
    const { assignmentId } = req.params;
    
    if (!assignmentId || isNaN(parseInt(assignmentId))) {
      throw new AppError("Invalid assignment ID", 400);
    }

    const assignment = await prisma.productAssignment.findUnique({
      where: {
        id: parseInt(assignmentId),
        deletedAt: null
      },
      select: {
        id: true,
        assignedAt: true,
        returnedAt: true,
        expectedReturnAt: true,
        status: true,
        returnCondition: true,
        notes: true,
        employee: {
          select: {
            id: true,
            empId: true,
            name: true,
            email: true,
            department: true,
            position: true,
            branch: {
              select: {
                name: true
              }
            }
          }
        },
        assignedBy: {
          select: {
            id: true,
            username: true
          }
        },
        inventory: {
          select: {
            id: true,
            serialNumber: true,
            status: true,
            condition: true,
            purchaseDate: true,
            warrantyExpiry: true,
            location: true,
            notes: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            model: true,
            warrantyDuration: true,
            minStockLevel: true,
            createdAt: true,
            category: {
              select: {
                name: true
              }
            },
            branch: {
              select: {
                name: true
              }
            },
            department: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!assignment) {
      throw new AppError("Assignment not found", 404);
    }

    // Calculate assignment status and overdue information
    const currentDate = new Date();
    const isOverdue = assignment.expectedReturnAt && 
                     !assignment.returnedAt && 
                     currentDate > assignment.expectedReturnAt;
    
    const daysOverdue = isOverdue && assignment.expectedReturnAt
      ? Math.floor((currentDate.getTime() - assignment.expectedReturnAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Format the response with assignment information
    const publicInfo = {
      assignment: {
        id: assignment.id,
        assignedAt: assignment.assignedAt,
        returnedAt: assignment.returnedAt,
        expectedReturnAt: assignment.expectedReturnAt,
        status: assignment.status,
        returnCondition: assignment.returnCondition,
        notes: assignment.notes,
        isOverdue: isOverdue,
        daysOverdue: daysOverdue
      },
      employee: {
        id: assignment.employee.id,
        empId: assignment.employee.empId,
        name: assignment.employee.name,
        email: assignment.employee.email,
        department: assignment.employee.department,
        position: assignment.employee.position,
        branch: assignment.employee.branch?.name || 'Not assigned'
      },
      assignedBy: {
        id: assignment.assignedBy.id,
        username: assignment.assignedBy.username
      },
      inventory: {
        id: assignment.inventory.id,
        serialNumber: assignment.inventory.serialNumber,
        status: assignment.inventory.status,
        condition: assignment.inventory.condition,
        purchaseDate: assignment.inventory.purchaseDate,
        warrantyExpiry: assignment.inventory.warrantyExpiry,
        location: assignment.inventory.location,
        notes: assignment.inventory.notes
      },
      product: {
        id: assignment.product.id,
        name: assignment.product.name,
        model: assignment.product.model,
        category: assignment.product.category?.name || 'Not assigned',
        branch: assignment.product.branch?.name || 'Not assigned',
        department: assignment.product.department?.name || 'Not assigned',
        warrantyDuration: assignment.product.warrantyDuration,
        minStockLevel: assignment.product.minStockLevel,
        createdAt: assignment.product.createdAt
      }
    };

    res.json({
      success: true,
      data: publicInfo
    });

  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to fetch assignment information", 500);
  }
}

// Get public inventory item information for QR code scanning
export async function getPublicInventoryInfo(req: Request, res: Response) {
  try {
    const { inventoryId } = req.params;

    if (!inventoryId || isNaN(parseInt(inventoryId))) {
      throw new AppError("Invalid inventory ID", 400);
    }

    const inventoryItem = await prisma.productInventory.findUnique({
      where: {
        id: parseInt(inventoryId),
        deletedAt: null
      },
      select: {
        id: true,
        serialNumber: true,
        status: true,
        condition: true,
        purchaseDate: true,
        warrantyExpiry: true,
        location: true,
        product: {
          select: {
            id: true,
            name: true,
            model: true,
            warrantyDuration: true,
            minStockLevel: true,
            createdAt: true,
            category: {
              select: {
                name: true
              }
            },
            branch: {
              select: {
                name: true
              }
            },
            department: {
              select: {
                name: true
              }
            }
          }
        },
        assignments: {
          where: {
            returnedAt: null,
            deletedAt: null
          },
          select: {
            id: true,
            assignedAt: true,
            expectedReturnAt: true,
            employee: {
              select: {
                id: true,
                empId: true,
                name: true,
                email: true,
                department: true,
                position: true
              }
            }
          }
        }
      }
    });

    if (!inventoryItem) {
      throw new AppError("Inventory item not found", 404);
    }

    // Format the response with product and inventory information
    const publicInfo = {
      inventory: {
        id: inventoryItem.id,
        serialNumber: inventoryItem.serialNumber,
        status: inventoryItem.status,
        condition: inventoryItem.condition,
        purchaseDate: inventoryItem.purchaseDate,
        warrantyExpiry: inventoryItem.warrantyExpiry,
        location: inventoryItem.location
      },
      product: {
        id: inventoryItem.product.id,
        name: inventoryItem.product.name,
        model: inventoryItem.product.model,
        category: inventoryItem.product.category?.name || 'Not assigned',
        branch: inventoryItem.product.branch?.name || 'Not assigned',
        department: inventoryItem.product.department?.name || 'Not assigned',
        warrantyDuration: inventoryItem.product.warrantyDuration,
        minStockLevel: inventoryItem.product.minStockLevel,
        createdAt: inventoryItem.product.createdAt
      },
      currentAssignment: inventoryItem.assignments.length > 0 ? {
        id: inventoryItem.assignments[0].id,
        assignedAt: inventoryItem.assignments[0].assignedAt,
        expectedReturnAt: inventoryItem.assignments[0].expectedReturnAt,
        employee: {
          id: inventoryItem.assignments[0].employee.id,
          empId: inventoryItem.assignments[0].employee.empId,
          name: inventoryItem.assignments[0].employee.name,
          email: inventoryItem.assignments[0].employee.email,
          department: inventoryItem.assignments[0].employee.department,
          position: inventoryItem.assignments[0].employee.position
        }
      } : null
    };

    res.json({
      success: true,
      data: publicInfo
    });

  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to fetch inventory information", 500);
  }
}