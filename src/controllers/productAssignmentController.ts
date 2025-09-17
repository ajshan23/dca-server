import { Request, Response } from "express";
import { AppError } from "../samples/errorHandler";
import prisma from "../database/db";
import QRCode from 'qrcode';
import ExcelJS from 'exceljs';
export async function assignProduct(req: Request, res: Response) {
  const { productId, employeeId, inventoryId, expectedReturnAt, notes, pcName, autoSelect = true } = req.body;
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
    const result = await prisma.$transaction(async (tx:any) => {
      // Verify product exists and is not deleted
      const product = await tx.product.findFirst({
        where: { id: productId, deletedAt: null }
      });
      if (!product) {
        throw new AppError("Product not found or is deleted", 404);
      }

      // Verify employee exists and is not deleted
      const employee = await tx.employee.findFirst({
        where: { id: employeeId, deletedAt: null }
      });
      if (!employee) {
        throw new AppError("Employee not found or is deleted", 404);
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
          throw new AppError("Specified inventory item not available for assignment", 400);
        }
      } else if (autoSelect) {
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
          throw new AppError("No inventory available for assignment", 400);
        }
      } else {
        throw new AppError("Either specify inventoryId or set autoSelect to true", 400);
      }

      // Validate expected return date if provided
      if (expectedReturnAt && new Date(expectedReturnAt) < new Date()) {
        throw new AppError("Expected return date cannot be in the past", 400);
      }

      // Update inventory status to ASSIGNED
      await tx.productInventory.update({
        where: { id: selectedInventory.id },
        data: { status: 'ASSIGNED' }
      });

      // Create new assignment with pcName
      const assignment = await tx.productAssignment.create({
        data: {
          productId,
          inventoryId: selectedInventory.id,
          employeeId,
          assignedById: parseInt(assignedById),
          pcName: pcName || null, // New field
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
          reason: `Assigned to ${employee.name} (${employee.empId})${pcName ? ` - PC: ${pcName}` : ''}`,
          reference: `ASSIGN-${assignment.id}`,
          userId: parseInt(assignedById)
        }
      });

      return assignment;
    });

    res.status(201).json({ success: true, data: result });
    return;
  } catch (error) {
    console.error('Assignment error:', error);
    
    
    
    if (error instanceof AppError) {
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


export async function returnProduct(req: Request, res: Response) {
  const { assignmentId } = req.params;
  const { condition, notes, inventoryStatus = 'AVAILABLE' } = req.body;
  const returnedById = req.user?.userId;

  try {
    const assignment = await prisma.productAssignment.findUnique({
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

    const result = await prisma.$transaction(async (tx:any) => {
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
  } catch (error) {
    console.error('Return error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to return product",
      error: error instanceof Error ? error.message : undefined
    });
    return;
  }
}

export async function getActiveAssignments(req: Request, res: Response) {
  try {
    const { page = "1", limit = "10", search, employeeId, productId, overdue } = req.query;

    const pageNumber = parseInt(page as string, 10) || 1;
    const limitNumber = parseInt(limit as string, 10) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    const where: any = {
      returnedAt: null,
      status: "ASSIGNED",
    };

    if (employeeId) where.employeeId = parseInt(employeeId as string);
    if (productId) where.productId = parseInt(productId as string);

    if (search) {
      const searchStr = String(search).toLowerCase();
      where.OR = [
        { product: { name: { contains: searchStr } } },
        { product: { model: { contains: searchStr } } },
        { employee: { name: { contains: searchStr } } },
        { inventory: { serialNumber: { contains: searchStr } } },
        { pcName: { contains: searchStr } }, // Search by PC name
      ];
    }

    if (overdue === "true") {
      where.expectedReturnAt = { lt: new Date() };
    }

    const [assignments, total] = await prisma.$transaction([
      prisma.productAssignment.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              model: true,
              category: true,
              branch: true,
            },
          },
          inventory: {
            select: {
              id: true,
              serialNumber: true,
              condition: true,
            },
          },
          employee: {
            select: {
              id: true,
              name: true,
              empId: true,
            },
          },
          assignedBy: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: { assignedAt: "desc" },
        skip,
        take: limitNumber,
      }),
      prisma.productAssignment.count({ where }),
    ]);

    const assignmentsWithStatus = assignments.map((assignment:any) => ({
      ...assignment,
      isOverdue: assignment.expectedReturnAt
        ? new Date() > assignment.expectedReturnAt
        : false,
      daysOverdue: assignment.expectedReturnAt
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - assignment.expectedReturnAt.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : 0,
    }));

    res.json({
      success: true,
      data: assignmentsWithStatus,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Error fetching active assignments:", error);
    throw new AppError("Failed to fetch active assignments", 500);
  }
}

export async function getAssignmentById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const assignmentId = parseInt(id);

    if (!id || isNaN(assignmentId)) {
      res.status(400).json({ 
        success: false, 
        message: "Valid assignment ID is required" 
      });
      return;
    }

    console.log(`[DEBUG] Looking for assignment ID: ${assignmentId}`);

    // First, check if any assignment exists with this ID (including soft-deleted ones)
    const anyAssignment = await prisma.productAssignment.findFirst({
      where: { id: assignmentId },
      select: { id: true, status: true, returnedAt: true, deletedAt: true }
    });

    console.log(`[DEBUG] Found assignment:`, anyAssignment);

    if (!anyAssignment) {
      res.status(404).json({ 
        success: false, 
        message: `Assignment with ID ${assignmentId} does not exist in the database` 
      });
      return;
    }

    // Check if assignment is soft-deleted
    if (anyAssignment.deletedAt) {
      res.status(404).json({ 
        success: false, 
        message: `Assignment with ID ${assignmentId} has been deleted` 
      });
      return;
    }

    // Now fetch the full details (excluding soft-deleted assignments)
    const assignment = await prisma.productAssignment.findUnique({
      where: { 
        id: assignmentId,
        deletedAt: null // Only fetch non-deleted assignments
      },
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } }
          }
        },
        inventory: {
          select: {
            id: true,
            serialNumber: true,
            condition: true,
            purchasePrice: true,
            location: true,
            purchaseDate: true,
            warrantyExpiry: true,
            notes: true
          }
        },
        employee: {
          select: {
            id: true,
            name: true,
            empId: true,
            department: true,
            position: true,
            email: true,
            branch: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        assignedBy: {
          select: {
            id: true,
            username: true,
            role: true
          }
        }
      }
    });

    console.log(`[DEBUG] Full assignment data:`, assignment);

    if (!assignment) {
      res.status(404).json({ 
        success: false, 
        message: "Assignment not found (unexpected error)" 
      });
      return;
    }

    res.json({ 
      success: true, 
      data: assignment 
    });
    return;
  } catch (error) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch assignment details",
      error: error instanceof Error ? error.message : undefined
    });
    return;
  }
}
export async function getAssignmentHistory(req: Request, res: Response) {
  try {
    const { page = 1, limit = 10, fromDate, toDate, employeeId, productId } = req.query;
    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    const where: any = {
      returnedAt: { not: null }
    };

    if (employeeId) where.employeeId = parseInt(employeeId as string);
    if (productId) where.productId = parseInt(productId as string);

    if (fromDate || toDate) {
      where.assignedAt = {};
      if (fromDate) where.assignedAt.gte = new Date(fromDate as string);
      if (toDate) where.assignedAt.lte = new Date(toDate as string);
    }

    const [assignments, total] = await prisma.$transaction([
      prisma.productAssignment.findMany({
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
      prisma.productAssignment.count({ where })
    ]);

    // Calculate assignment duration for each record
    const assignmentsWithDuration = assignments.map((assignment :any)=> {
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
  } catch (error) {
    console.error('Error fetching assignment history:', error);
    throw new AppError("Failed to fetch assignment history", 500);
  }
}

export async function getEmployeeAssignments(req: Request, res: Response) {
  try {
    const { employeeId } = req.params;
    const { active = 'true' } = req.query;

    const where: any = {
      employeeId: parseInt(employeeId)
    };

    if (active === 'true') {
      where.returnedAt = null;
    }

    const assignments = await prisma.productAssignment.findMany({
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
    const assignmentsWithStatus = assignments.map((assignment:any) => ({
      ...assignment,
      isOverdue: assignment.expectedReturnAt && !assignment.returnedAt ? 
        new Date() > assignment.expectedReturnAt : false,
      status: assignment.returnedAt ? 'RETURNED' : 
              (assignment.expectedReturnAt && new Date() > assignment.expectedReturnAt) ? 'OVERDUE' : 'ASSIGNED'
    }));

    res.json({ success: true, data: assignmentsWithStatus });
  } catch (error) {
    throw new AppError("Failed to fetch employee assignments", 500);
  }
}

export async function updateAssignment(req: Request, res: Response) {
  try {
    const { assignmentId } = req.params;
    const { expectedReturnAt, notes } = req.body;

    const assignment = await prisma.productAssignment.findUnique({
      where: { id: parseInt(assignmentId) }
    });

    if (!assignment) throw new AppError("Assignment not found", 404);
    if (assignment.status === "RETURNED") {
      throw new AppError("Cannot modify returned assignments", 400);
    }

    const updatedAssignment = await prisma.productAssignment.update({
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
  } catch (error) {
    throw error;
  }
}



export async function getProductAssignments(req: Request, res: Response) {
  const { productId } = req.params;
  
  if (!productId) {
    res.status(400).json({ 
      success: false, 
      message: "Product ID is required" 
    });
    return;
  }

  try {
    const assignments = await prisma.productAssignment.findMany({
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
  } catch (error) {
    console.error('Error fetching product assignments:', error);
    
  
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch product assignments",
      error: undefined
    });
    return;
  }
}

// New function to get assignment analytics
export async function getAssignmentAnalytics(req: Request, res: Response) {
  try {
    const { fromDate, toDate } = req.query;
    
    const dateFilter: any = {};
    if (fromDate) dateFilter.gte = new Date(fromDate as string);
    if (toDate) dateFilter.lte = new Date(toDate as string);

    const analytics = await prisma.$transaction(async (tx:any) => {
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
        topEmployees: topEmployees.map((e:any) => ({ employeeId: e.employeeId, count: e._count.id })),
        topProducts: topProducts.map((p:any) => ({ productId: p.productId, count: p._count.id }))
      };
    });

    res.json({ success: true, data: analytics });
  } catch (error) {
    throw new AppError("Failed to fetch assignment analytics", 500);
  }
}


export async function generateAssignmentQr(req: Request, res: Response) {
  try {
    const { assignmentId } = req.params;

    if (!assignmentId || isNaN(parseInt(assignmentId))) {
      throw new Error("Invalid assignment ID");
    }

    const assignment = await prisma.productAssignment.findUnique({
      where: { id: parseInt(assignmentId) },
      include: {
        product: true,
        employee: true,
        inventory: true
      }
    });

    if (!assignment) throw new AppError("Assignment not found", 404);

    const assignmentUrl = `${process.env.FRONTEND_URL}/product-public-view/${assignmentId}`;

    const qrCode = await new Promise<string>((resolve, reject) => {
      QRCode.toDataURL(assignmentUrl, {
        errorCorrectionLevel: 'H',
        width: 300,
        margin: 1
      }, (err, url) => {
        if (err) return reject(err);
        resolve(url);
      });
    });
    console.log(qrCode);
    
    res.json({
      success: true,
      qrCode,
      assignmentInfo: {
        id: assignment.id,
        productName: assignment.product.name,
        employeeName: assignment.employee.name,
        assignedAt: assignment.assignedAt,
        expectedReturnAt: assignment.expectedReturnAt,
        status: assignment.status
      }
    });
  } catch (error) {
    console.error('Assignment QR generation error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate QR code'
    });
  }
}
  

 export async function exportAssignmentsToExcel(req: Request, res: Response) {
  try {
    const {
      fromDate,
      toDate,
      employeeId,
      productId,
      categoryId,
      branchId,
      departmentId,
      status,
      month,
      year,
      format = 'active' // 'active', 'history', 'all'
    } = req.query;

    // Build where clause based on filters
    const where: any = {};
    
    // Date filters
    if (month && year) {
      const startDate = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
      const endDate = new Date(parseInt(year as string), parseInt(month as string), 0);
      where.assignedAt = {
        gte: startDate,
        lte: endDate
      };
    } else {
      if (fromDate || toDate) {
        where.assignedAt = {};
        if (fromDate) where.assignedAt.gte = new Date(fromDate as string);
        if (toDate) where.assignedAt.lte = new Date(toDate as string);
      }
    }

    // Status filters
    if (format === 'active') {
      where.returnedAt = null;
      where.status = 'ASSIGNED';
    } else if (format === 'history') {
      where.returnedAt = { not: null };
    }
    
    if (status) where.status = status;
    if (employeeId) where.employeeId = parseInt(employeeId as string);
    if (productId) where.productId = parseInt(productId as string);
    
    // Category, branch, department filters
    if (categoryId || branchId || departmentId) {
      where.product = {};
      if (categoryId) where.product.categoryId = parseInt(categoryId as string);
      if (branchId) where.product.branchId = parseInt(branchId as string);
      if (departmentId) where.product.departmentId = parseInt(departmentId as string);
    }

    // Fetch assignments data
    const assignments = await prisma.productAssignment.findMany({
      where,
      include: {
        product: {
          include: {
            category: { select: { name: true } },
            branch: { select: { name: true } },
            department: { select: { name: true } }
          }
        },
        inventory: {
          select: {
            id: true,
            serialNumber: true,
            condition: true,
            purchasePrice: true,
            location: true
          }
        },
        employee: {
          select: {
            id: true,
            name: true,
            empId: true,
            department: true,
            position: true
          }
        },
        assignedBy: {
          select: {
            username: true
          }
        }
      },
      orderBy: { assignedAt: 'desc' }
    });

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Product Assignments');

    // Set up columns (with PC Name added)
    worksheet.columns = [
      { header: 'Assignment ID', key: 'id', width: 15 },
      { header: 'Product Name', key: 'productName', width: 25 },
      { header: 'Product Model', key: 'productModel', width: 20 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Branch', key: 'branch', width: 15 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Serial Number', key: 'serialNumber', width: 20 },
      { header: 'Employee Name', key: 'employeeName', width: 25 },
      { header: 'Employee ID', key: 'employeeId', width: 15 },
      { header: 'Employee Position', key: 'employeePosition', width: 20 },
      { header: 'Employee Department', key: 'employeeDepartment', width: 20 },
      { header: 'PC Name', key: 'pcName', width: 20 }, // New column
      { header: 'Assigned By', key: 'assignedBy', width: 15 },
      { header: 'Assigned Date', key: 'assignedAt', width: 15 },
      { header: 'Expected Return', key: 'expectedReturnAt', width: 15 },
      { header: 'Returned Date', key: 'returnedAt', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Return Condition', key: 'returnCondition', width: 15 },
      { header: 'Item Condition', key: 'itemCondition', width: 15 },
      { header: 'Purchase Price', key: 'purchasePrice', width: 15 },
      { header: 'Location', key: 'location', width: 15 },
      { header: 'Duration (Days)', key: 'duration', width: 15 },
      { header: 'Overdue Status', key: 'overdueStatus', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 }
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' }
    };

    // Add data rows
    assignments.forEach((assignment:any) => {
      const assignedDate = new Date(assignment.assignedAt);
      const returnedDate = assignment.returnedAt ? new Date(assignment.returnedAt) : null;
      const expectedDate = assignment.expectedReturnAt ? new Date(assignment.expectedReturnAt) : null;
      
      // Calculate duration
      const endDate = returnedDate || new Date();
      const durationDays = Math.floor((endDate.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check overdue status
      let overdueStatus = 'N/A';
      if (!returnedDate && expectedDate) {
        overdueStatus = new Date() > expectedDate ? 'Overdue' : 'On Time';
      } else if (returnedDate && expectedDate) {
        overdueStatus = returnedDate > expectedDate ? 'Was Overdue' : 'Returned On Time';
      }

      worksheet.addRow({
        id: assignment.id,
        productName: assignment.product.name,
        productModel: assignment.product.model,
        category: assignment.product.category?.name || 'N/A',
        branch: assignment.product.branch?.name || 'N/A',
        department: assignment.product.department?.name || 'N/A',
        serialNumber: assignment.inventory.serialNumber || `Item #${assignment.inventory.id}`,
        employeeName: assignment.employee.name,
        employeeId: assignment.employee.empId,
        employeePosition: assignment.employee.position || 'N/A',
        employeeDepartment: assignment.employee.department || 'N/A',
        pcName: assignment.pcName || 'N/A', // PC Name column
        assignedBy: assignment.assignedBy.username,
        assignedAt: assignedDate.toLocaleDateString(),
        expectedReturnAt: expectedDate?.toLocaleDateString() || 'N/A',
        returnedAt: returnedDate?.toLocaleDateString() || 'Not Returned',
        status: assignment.status,
        returnCondition: assignment.returnCondition || 'N/A',
        itemCondition: assignment.inventory.condition,
        purchasePrice: assignment.inventory.purchasePrice ? `${assignment.inventory.purchasePrice}` : 'N/A',
        location: assignment.inventory.location || 'N/A',
        duration: durationDays,
        overdueStatus,
        notes: assignment.notes || ''
      });
    });

    // Add summary section
    worksheet.addRow([]);
    worksheet.addRow(['SUMMARY']);
    worksheet.addRow(['Total Assignments:', assignments.length]);
    worksheet.addRow(['Active Assignments:', assignments.filter((a:any) => !a.returnedAt).length]);
    worksheet.addRow(['Returned Assignments:', assignments.filter((a:any) => a.returnedAt).length]);
    worksheet.addRow(['Overdue Assignments:', assignments.filter((a:any) => !a.returnedAt && a.expectedReturnAt && new Date() > new Date(a.expectedReturnAt)).length]);

    // Style summary section
    const summaryStartRow = worksheet.rowCount - 4;
    for (let i = summaryStartRow; i <= worksheet.rowCount; i++) {
      worksheet.getRow(i).font = { bold: true };
      worksheet.getRow(i).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF2CC' }
      };
    }

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    let filename = `product-assignments-${timestamp}`;
    
    if (month && year) {
      const monthName = new Date(parseInt(year as string), parseInt(month as string) - 1).toLocaleString('default', { month: 'long' });
      filename = `product-assignments-${monthName}-${year}`;
    }
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export assignments to Excel',
      error: error instanceof Error ? error.message : undefined
    });
  }
}
