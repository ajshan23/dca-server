import { Request, Response } from "express";
import { AppError } from "../samples/errorHandler";
import prisma from "../database/db";
import QRCode from 'qrcode';
import ExcelJS from 'exceljs';
// Create a new product template
export async function createProduct(req: Request, res: Response) {
  try {
    const {
      name,
      model,
      categoryId,
      branchId,
      departmentId,
      warrantyDuration,
      complianceStatus,
      description,
      minStockLevel,
      initialStock = 0,
      serialNumbers = [],
      purchaseDate,
      purchasePrice,
      location
    } = req.body;

    if (!name || !model || !categoryId || !branchId) {
      throw new AppError("Name, model, category and branch are required", 400);
    }

    // Validate references
    const [category, branch] = await Promise.all([
      prisma.category.findFirst({ where: { id: categoryId, deletedAt: null } }),
      prisma.branch.findFirst({ where: { id: branchId, deletedAt: null } })
    ]);

    if (!category) throw new AppError("Category not found", 404);
    if (!branch) throw new AppError("Branch not found", 404);

    if (departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, deletedAt: null }
      });
      if (!department) throw new AppError("Department not found", 404);
    }

    // Create product with initial inventory
    const result = await prisma.$transaction(async (tx) => {
      // Create product template
      const product = await tx.product.create({
        data: {
          name,
          model,
          categoryId,
          branchId,
          departmentId: departmentId || null,
          warrantyDuration: warrantyDuration || null,
          complianceStatus: complianceStatus || false,
          description,
          minStockLevel: minStockLevel || 0
        }
      });

      // Create initial inventory items
      const inventoryItems = [];
      for (let i = 0; i < initialStock; i++) {
        const serialNumber = serialNumbers[i] || null;
        const warrantyExpiry = warrantyDuration ?
          new Date(Date.now() + warrantyDuration * 30 * 24 * 60 * 60 * 1000) : null;

        const inventoryItem = await tx.productInventory.create({
          data: {
            productId: product.id,
            serialNumber,
            purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
            purchasePrice: purchasePrice || null,
            warrantyExpiry,
            location: location || null,
            status: "AVAILABLE",
            condition: "NEW"
          }
        });
        inventoryItems.push(inventoryItem);

        // Create stock transaction record
        await tx.stockTransaction.create({
          data: {
            inventoryId: inventoryItem.id,
            type: "IN",
            quantity: 1,
            reason: "Initial stock",
            reference: `INIT-${product.id}-${i + 1}`
          }
        });
      }

      return {
        product: await tx.product.findUnique({
          where: { id: product.id },
          include: {
            category: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            inventory: {
              select: {
                id: true,
                serialNumber: true,
                status: true,
                condition: true
              }
            }
          }
        }),
        inventoryCount: inventoryItems.length
      };
    });

    res.status(201).json({
      success: true,
      data: result.product,
      message: `Product created with ${result.inventoryCount} inventory items`
    });
  } catch (error) {
    throw error;
  }
}

// Get all products with stock information
export async function getAllProducts(req: Request, res: Response) {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      categoryId,
      branchId,
      departmentId,
      complianceStatus,
      stockStatus // NEW: Filter by stock status (low, out, available)
    } = req.query;

    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { model: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    if (categoryId) where.categoryId = parseInt(categoryId as string);
    if (branchId) where.branchId = parseInt(branchId as string);
    if (departmentId) where.departmentId = parseInt(departmentId as string);
    if (complianceStatus) where.complianceStatus = complianceStatus === 'true';

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        where,
        include: {
          category: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          inventory: {
            select: {
              id: true,
              status: true,
              condition: true,
              serialNumber: true
            }
          },
          _count: {
            select: {
              inventory: true,
              assignments: {
                where: { returnedAt: null }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.count({ where })
    ]);

    const transformedProducts = products.map(product => {
      const totalStock = product.inventory.length;
      const availableStock = product.inventory.filter(item => item.status === 'AVAILABLE').length;
      const assignedStock = product._count.assignments;
      const damagedStock = product.inventory.filter(item => item.status === 'DAMAGED').length;
      const maintenanceStock = product.inventory.filter(item => item.status === 'MAINTENANCE').length;

      return {
        ...product,
        stockInfo: {
          totalStock,
          availableStock,
          assignedStock,
          damagedStock,
          maintenanceStock,
          stockStatus: availableStock === 0 ? 'OUT_OF_STOCK' :
            availableStock <= product.minStockLevel ? 'LOW_STOCK' : 'AVAILABLE'
        }
      };
    });

    // Filter by stock status if requested
    let filteredProducts = transformedProducts;
    if (stockStatus) {
      filteredProducts = transformedProducts.filter(product => {
        switch (stockStatus) {
          case 'low':
            return product.stockInfo.stockStatus === 'LOW_STOCK';
          case 'out':
            return product.stockInfo.stockStatus === 'OUT_OF_STOCK';
          case 'available':
            return product.stockInfo.stockStatus === 'AVAILABLE';
          default:
            return true;
        }
      });
    }

    res.json({
      success: true,
      data: filteredProducts,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    throw new AppError("Failed to fetch products", 500);
  }
}

// Get product by ID with detailed stock information
export async function getProductById(req: Request, res: Response) {
  try {
    const product = await prisma.product.findUnique({
      where: {
        id: parseInt(req.params.id),
        deletedAt: null
      },
      include: {
        category: {
          select: { id: true, name: true }
        },
        branch: {
          select: { id: true, name: true }
        },
        department: {
          select: { id: true, name: true }
        },
        inventory: {
          where: { deletedAt: null }, // Add this filter to exclude deleted inventory items
          include: {
            assignments: {
              where: { returnedAt: null },
              include: {
                employee: {
                  select: { id: true, name: true, empId: true }
                },
                assignedBy: {
                  select: { id: true, username: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        assignments: {
          orderBy: { assignedAt: 'desc' },
          take: 10,
          include: {
            inventory: {
              select: { id: true, serialNumber: true }
            },
            employee: {
              select: { id: true, name: true, empId: true }
            },
            assignedBy: {
              select: { id: true, username: true }
            }
          }
        }
      }
    });

    if (!product) throw new AppError("Product not found", 404);

    // Calculate stock statistics (now excludes deleted items)
    const stockStats = {
      totalStock: product.inventory.length,
      availableStock: product.inventory.filter(item => item.status === 'AVAILABLE').length,
      assignedStock: product.inventory.filter(item => item.status === 'ASSIGNED').length,
      damagedStock: product.inventory.filter(item => item.status === 'DAMAGED').length,
      maintenanceStock: product.inventory.filter(item => item.status === 'MAINTENANCE').length,
      retiredStock: product.inventory.filter(item => item.status === 'RETIRED').length
    };

    res.json({ success: true, data: { ...product, stockStats } });
  } catch (error) {
    throw error;
  }
}
// Add stock to existing product
export async function addStock(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      quantity = 1,
      serialNumbers = [],
      purchaseDate,
      purchasePrice,
      location,
      condition = "NEW",
      reference,
      reason = "Stock replenishment"
    } = req.body;

    const product = await prisma.product.findUnique({
      where: { id: parseInt(id), deletedAt: null }
    });

    if (!product) throw new AppError("Product not found", 404);

    const result = await prisma.$transaction(async (tx) => {
      const inventoryItems = [];

      for (let i = 0; i < quantity; i++) {
        const serialNumber = serialNumbers[i] || null;
        const warrantyExpiry = product.warrantyDuration ?
          new Date(Date.now() + product.warrantyDuration * 30 * 24 * 60 * 60 * 1000) : null;

        // Check if serial number already exists
        if (serialNumber) {
          const existingItem = await tx.productInventory.findUnique({
            where: { serialNumber }
          });
          if (existingItem) {
            throw new AppError(`Serial number ${serialNumber} already exists`, 409);
          }
        }

        const inventoryItem = await tx.productInventory.create({
          data: {
            productId: parseInt(id),
            serialNumber,
            purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
            purchasePrice: purchasePrice || null,
            warrantyExpiry,
            location: location || null,
            status: "AVAILABLE",
            condition
          }
        });
        inventoryItems.push(inventoryItem);

        // Create stock transaction record
        await tx.stockTransaction.create({
          data: {
            inventoryId: inventoryItem.id,
            type: "IN",
            quantity: 1,
            reason,
            reference: reference || `ADD-${Date.now()}-${i + 1}`
          }
        });
      }

      return inventoryItems;
    });

    res.status(201).json({
      success: true,
      data: result,
      message: `Added ${quantity} items to stock`
    });
  } catch (error) {
    throw error;
  }
}

// Update inventory item
export async function updateInventoryItem(req: Request, res: Response) {
  try {
    const { inventoryId } = req.params;
    const {
      status,
      condition,
      location,
      notes,
      serialNumber,
      warrantyExpiry,
      reason = "Manual update"
    } = req.body;

    const inventoryItem = await prisma.productInventory.findUnique({
      where: { id: parseInt(inventoryId) },
      include: {
        assignments: { where: { returnedAt: null } }
      }
    });

    if (!inventoryItem) throw new AppError("Inventory item not found", 404);

    // Prevent status change if item is currently assigned
    if (inventoryItem.assignments.length > 0 && status && status !== inventoryItem.status) {
      throw new AppError("Cannot change status of assigned item", 400);
    }

    const updatedItem = await prisma.$transaction(async (tx) => {
      const updated = await tx.productInventory.update({
        where: { id: parseInt(inventoryId) },
        data: {
          status: status || inventoryItem.status,
          condition: condition || inventoryItem.condition,
          location: location || inventoryItem.location,
          notes: notes || inventoryItem.notes,
          serialNumber: serialNumber || inventoryItem.serialNumber,
          warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : inventoryItem.warrantyExpiry
        },
        include: {
          product: { select: { id: true, name: true, model: true } }
        }
      });

      // Log the change if status changed
      if (status && status !== inventoryItem.status) {
        await tx.stockTransaction.create({
          data: {
            inventoryId: parseInt(inventoryId),
            type: "ADJUSTMENT",
            quantity: 1,
            reason: `Status changed from ${inventoryItem.status} to ${status}: ${reason}`,
            reference: `UPD-${Date.now()}`
          }
        });
      }

      return updated;
    });

    res.json({
      success: true,
      data: updatedItem,
      message: "Inventory item updated successfully"
    });
  } catch (error) {
    throw error;
  }
}

// Get available inventory for assignment
export async function getAvailableInventory(req: Request, res: Response) {
  try {
    const { productId } = req.params;

    const availableItems = await prisma.productInventory.findMany({
      where: {
        productId: parseInt(productId),
        status: 'AVAILABLE',
        deletedAt: null
      },
      include: {
        product: { select: { id: true, name: true, model: true } }
      },
      orderBy: { createdAt: 'asc' } // FIFO - First In, First Out
    });

    res.json({
      success: true,
      data: availableItems,
      count: availableItems.length
    });
  } catch (error) {
    throw new AppError("Failed to fetch available inventory", 500);
  }
}

// Permanently delete inventory item
export async function deleteInventoryItem(req: Request, res: Response) {
  try {
    const { inventoryId } = req.params;

    // Find the inventory item and check for active assignments
    const inventoryItem = await prisma.productInventory.findUnique({
      where: { id: parseInt(inventoryId) },
      include: {
        assignments: { where: { returnedAt: null } }
      }
    });

    if (!inventoryItem) {
      throw new AppError("Inventory item not found", 404);
    }

    // Check if item is currently assigned
    if (inventoryItem.assignments.length > 0) {
      throw new AppError("Cannot delete assigned item", 400);
    }

    // Permanently delete in transaction
    await prisma.$transaction(async (tx) => {
      // Delete related records first (foreign key constraints)
      await tx.stockTransaction.deleteMany({
        where: { inventoryId: parseInt(inventoryId) }
      });

      await tx.productAssignment.deleteMany({
        where: { inventoryId: parseInt(inventoryId) }
      });

      // Finally delete the inventory item
      await tx.productInventory.delete({
        where: { id: parseInt(inventoryId) }
      });
    });

    res.json({
      success: true,
      message: "Inventory item deleted permanently"
    });

  } catch (error) {
    throw error;
  }
}

// Get stock transactions/history
export async function getStockTransactions(req: Request, res: Response) {
  try {
    const {
      page = 1,
      limit = 10,
      productId,
      inventoryId,
      type,
      fromDate,
      toDate
    } = req.query;

    const where: any = {};

    if (productId) {
      where.inventory = { productId: parseInt(productId as string) };
    }
    if (inventoryId) where.inventoryId = parseInt(inventoryId as string);
    if (type) where.type = type as string;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate as string);
      if (toDate) where.createdAt.lte = new Date(toDate as string);
    }

    const [transactions, total] = await Promise.all([
      prisma.stockTransaction.findMany({
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        where,
        include: {
          inventory: {
            include: {
              product: { select: { id: true, name: true, model: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.stockTransaction.count({ where })
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    throw new AppError("Failed to fetch stock transactions", 500);
  }
}

// Generate QR code for inventory item
export async function generateInventoryQr(req: Request, res: Response) {
  try {
    const { inventoryId } = req.params;

    if (!inventoryId || isNaN(parseInt(inventoryId))) {
      throw new Error("Invalid inventory ID");
    }

    const inventoryItem = await prisma.productInventory.findUnique({
      where: { id: parseInt(inventoryId) },
      include: { product: true }
    });

    if (!inventoryItem) throw new AppError("Inventory item not found", 404);

    const itemUrl = `${process.env.FRONTEND_URL}/inventory-view/${inventoryId}`;

    const qrCode = await new Promise<string>((resolve, reject) => {
      QRCode.toDataURL(itemUrl, {
        errorCorrectionLevel: 'H',
        width: 300,
        margin: 1
      }, (err, url) => {
        if (err) return reject(err);
        resolve(url);
      });
    });

    res.json({
      success: true,
      qrCode,
      itemInfo: {
        id: inventoryItem.id,
        productName: inventoryItem.product.name,
        serialNumber: inventoryItem.serialNumber,
        status: inventoryItem.status
      }
    });
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate QR code'
    });
  }
}

// Legacy function - kept for backward compatibility
export async function updateProduct(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      name,
      model,
      categoryId,
      branchId,
      departmentId,
      warrantyDuration,
      complianceStatus,
      description,
      minStockLevel
    } = req.body;

    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    });

    if (!product) throw new AppError("Product not found", 404);

    // Validate references if changed
    if (categoryId && categoryId !== product.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, deletedAt: null }
      });
      if (!category) throw new AppError("Category not found", 404);
    }

    if (branchId && branchId !== product.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, deletedAt: null }
      });
      if (!branch) throw new AppError("Branch not found", 404);
    }

    if (departmentId && departmentId !== product.departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, deletedAt: null }
      });
      if (!department) throw new AppError("Department not found", 404);
    }

    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        name: name || product.name,
        model: model || product.model,
        categoryId: categoryId || product.categoryId,
        branchId: branchId || product.branchId,
        departmentId: departmentId !== undefined ? departmentId : product.departmentId,
        warrantyDuration: warrantyDuration !== undefined ? warrantyDuration : product.warrantyDuration,
        complianceStatus: complianceStatus !== undefined ? complianceStatus : product.complianceStatus,
        description: description || product.description,
        minStockLevel: minStockLevel !== undefined ? minStockLevel : product.minStockLevel
      },
      include: {
        category: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        _count: { select: { inventory: true } }
      }
    });

    res.json({ success: true, data: updatedProduct });
  } catch (error) {
    throw error;
  }
}

// Legacy function - kept for backward compatibility
export async function deleteProduct(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            assignments: { where: { returnedAt: null } },
            inventory: true
          }
        }
      }
    });

    if (!product) throw new AppError("Product not found", 404);

    if (product._count.assignments > 0) {
      throw new AppError("Cannot delete product with active assignments", 400);
    }

    await prisma.$transaction(async (tx) => {
      // Soft delete all inventory items
      await tx.productInventory.updateMany({
        where: { productId: parseInt(id) },
        data: { deletedAt: new Date() }
      });

      // Soft delete the product
      await tx.product.update({
        where: { id: parseInt(id) },
        data: { deletedAt: new Date() }
      });
    });

    res.json({ success: true, message: "Product and all inventory items deleted successfully" });
  } catch (error) {
    throw error;
  }
}

// Legacy function - kept for backward compatibility but now shows assigned inventory
export async function getAssignedProducts(_req: Request, res: Response) {
  try {
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        assignments: {
          some: {
            returnedAt: null
          }
        }
      },
      include: {
        category: { select: { name: true } },
        assignments: {
          where: { returnedAt: null },
          include: {
            inventory: { select: { id: true, serialNumber: true } },
            employee: { select: { name: true } }
          }
        }
      }
    });

    res.json({ success: true, data: products });
  } catch (error) {
    throw new AppError("Failed to fetch assigned products", 500);
  }
}

// New function to get stock dashboard/summary
export async function getStockSummary(_req: Request, res: Response) {
  try {
    const summary = await prisma.$transaction(async (tx) => {
      // Get total products
      const totalProducts = await tx.product.count({
        where: { deletedAt: null }
      });

      // Get total inventory items
      const totalInventory = await tx.productInventory.count({
        where: { deletedAt: null }
      });

      // Get stock by status
      const stockByStatus = await tx.productInventory.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { id: true }
      });

      // Get low stock products
      const lowStockProducts = await tx.product.findMany({
        where: {
          deletedAt: null,
          inventory: {
            some: { 
              status: 'AVAILABLE',
              deletedAt: null 
            }
          }
        },
        include: {
          _count: {
            select: {
              inventory: { 
                where: { 
                  status: 'AVAILABLE',
                  deletedAt: null 
                } 
              }
            }
          }
        }
      });

      const actualLowStock = lowStockProducts.filter(
        product => product._count.inventory <= product.minStockLevel
      );

      // Get recent transactions - filter by non-deleted inventory
      const recentTransactions = await tx.stockTransaction.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        where: {
          inventory: {
            deletedAt: null,
            product: {
              deletedAt: null
            }
          }
        },
        include: {
          inventory: {
            include: {
              product: { 
                select: { 
                  name: true, 
                  model: true 
                } 
              }
            }
          }
        }
      });

      return {
        totalProducts,
        totalInventory,
        stockByStatus: stockByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        lowStockCount: actualLowStock.length,
        lowStockProducts: actualLowStock.map(p => ({
          id: p.id,
          name: p.name,
          model: p.model,
          currentStock: p._count.inventory,
          minStock: p.minStockLevel
        })),
        recentTransactions
      };
    });

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Stock summary error:', error);
    throw new AppError("Failed to fetch stock summary", 500);
  }
}
// Legacy QR generation - now generates for product template
export async function generateProductQr(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      throw new Error("Invalid product ID");
    }

    const productUrl = `${process.env.FRONTEND_URL}/products-view/${id}`;

    const qrCode = await new Promise<string>((resolve, reject) => {
      QRCode.toDataURL(productUrl, {
        errorCorrectionLevel: 'H',
        width: 300,
        margin: 1
      }, (err, url) => {
        if (err) return reject(err);
        resolve(url);
      });
    });

    res.json({
      success: true,
      qrCode
    });
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate QR code'
    });
  }
}

export async function exportProductsToExcel(req: Request, res: Response) {
  try {
    const {
      categoryId,
      branchId,
      departmentId,
      stockStatus,
      complianceStatus,
      includeInventory = 'false'
    } = req.query;

    // Build where clause
    const where: any = { deletedAt: null };
    
    if (categoryId) where.categoryId = parseInt(categoryId as string);
    if (branchId) where.branchId = parseInt(branchId as string);
    if (departmentId) where.departmentId = parseInt(departmentId as string);
    if (complianceStatus) where.complianceStatus = complianceStatus === 'true';

    // Fetch products with stock information
    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        branch: { select: { name: true } },
        department: { select: { name: true } },
        inventory: {
          select: {
            id: true,
            serialNumber: true,
            status: true,
            condition: true,
            purchaseDate: true,
            purchasePrice: true,
            warrantyExpiry: true,
            location: true
          }
        },
        _count: {
          select: {
            inventory: true,
            assignments: {
              where: { returnedAt: null }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Transform products with stock info and filter by stock status
    let transformedProducts = products.map(product => {
      const totalStock = product.inventory.length;
      const availableStock = product.inventory.filter(item => item.status === 'AVAILABLE').length;
      const assignedStock = product._count.assignments;
      const damagedStock = product.inventory.filter(item => item.status === 'DAMAGED').length;
      const maintenanceStock = product.inventory.filter(item => item.status === 'MAINTENANCE').length;
      const retiredStock = product.inventory.filter(item => item.status === 'RETIRED').length;

      const stockStatusValue = availableStock === 0 ? 'OUT_OF_STOCK' :
        availableStock <= product.minStockLevel ? 'LOW_STOCK' : 'AVAILABLE';

      return {
        ...product,
        stockInfo: {
          totalStock,
          availableStock,
          assignedStock,
          damagedStock,
          maintenanceStock,
          retiredStock,
          stockStatus: stockStatusValue
        }
      };
    });

    // Filter by stock status if specified
    if (stockStatus) {
      transformedProducts = transformedProducts.filter(product => {
        switch (stockStatus) {
          case 'low':
            return product.stockInfo.stockStatus === 'LOW_STOCK';
          case 'out':
            return product.stockInfo.stockStatus === 'OUT_OF_STOCK';
          case 'available':
            return product.stockInfo.stockStatus === 'AVAILABLE';
          default:
            return true;
        }
      });
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    
    // Products Overview Sheet
    const productsSheet = workbook.addWorksheet('Products Overview');
    
    productsSheet.columns = [
      { header: 'Product ID', key: 'id', width: 12 },
      { header: 'Product Name', key: 'name', width: 30 },
      { header: 'Model', key: 'model', width: 20 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Branch', key: 'branch', width: 15 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Total Stock', key: 'totalStock', width: 12 },
      { header: 'Available', key: 'availableStock', width: 12 },
      { header: 'Assigned', key: 'assignedStock', width: 12 },
      { header: 'Damaged', key: 'damagedStock', width: 12 },
      { header: 'Maintenance', key: 'maintenanceStock', width: 12 },
      { header: 'Retired', key: 'retiredStock', width: 12 },
      { header: 'Min Stock Level', key: 'minStockLevel', width: 15 },
      { header: 'Stock Status', key: 'stockStatus', width: 15 },
      { header: 'Compliance', key: 'complianceStatus', width: 12 },
      { header: 'Warranty (Months)', key: 'warrantyDuration', width: 18 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Created Date', key: 'createdAt', width: 15 }
    ];

    // Style header
    productsSheet.getRow(1).font = { bold: true };
    productsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' }
    };

    // Add product data
    transformedProducts.forEach(product => {
      productsSheet.addRow({
        id: product.id,
        name: product.name,
        model: product.model,
        category: product.category?.name || 'N/A',
        branch: product.branch?.name || 'N/A',
        department: product.department?.name || 'N/A',
        totalStock: product.stockInfo.totalStock,
        availableStock: product.stockInfo.availableStock,
        assignedStock: product.stockInfo.assignedStock,
        damagedStock: product.stockInfo.damagedStock,
        maintenanceStock: product.stockInfo.maintenanceStock,
        retiredStock: product.stockInfo.retiredStock,
        minStockLevel: product.minStockLevel,
        stockStatus: product.stockInfo.stockStatus,
        complianceStatus: product.complianceStatus ? 'Yes' : 'No',
        warrantyDuration: product.warrantyDuration || 'N/A',
        description: product.description || '',
        createdAt: new Date(product.createdAt).toLocaleDateString()
      });
    });

    // If inventory details are requested, create separate sheet
    if (includeInventory === 'true') {
      const inventorySheet = workbook.addWorksheet('Inventory Details');
      
      inventorySheet.columns = [
        { header: 'Inventory ID', key: 'inventoryId', width: 15 },
        { header: 'Product Name', key: 'productName', width: 30 },
        { header: 'Model', key: 'model', width: 20 },
        { header: 'Serial Number', key: 'serialNumber', width: 20 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Condition', key: 'condition', width: 12 },
        { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
        { header: 'Purchase Price', key: 'purchasePrice', width: 15 },
        { header: 'Warranty Expiry', key: 'warrantyExpiry', width: 15 },
        { header: 'Location', key: 'location', width: 20 }
      ];

      // Style header
      inventorySheet.getRow(1).font = { bold: true };
      inventorySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFE6CC' }
      };

      // Add inventory data
      transformedProducts.forEach(product => {
        product.inventory.forEach(item => {
          inventorySheet.addRow({
            inventoryId: item.id,
            productName: product.name,
            model: product.model,
            serialNumber: item.serialNumber || `Item #${item.id}`,
            status: item.status,
            condition: item.condition,
            purchaseDate: item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : 'N/A',
            purchasePrice: item.purchasePrice ? `$${item.purchasePrice}` : 'N/A',
            warrantyExpiry: item.warrantyExpiry ? new Date(item.warrantyExpiry).toLocaleDateString() : 'N/A',
            location: item.location || 'N/A'
          });
        });
      });
    }

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `products-report-${timestamp}`;

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Products Excel export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export products to Excel',
      error: error instanceof Error ? error.message : undefined
    });
  }
}
export async function bulkDeleteInventoryItems(req: Request, res: Response) {
  try {
    const { inventoryIds } = req.body;

    if (!inventoryIds || !Array.isArray(inventoryIds) || inventoryIds.length === 0) {
      throw new AppError("Inventory IDs array is required", 400);
    }

    // Convert to numbers and validate
    const numericIds = inventoryIds.map(id => parseInt(id));
    if (numericIds.some(id => isNaN(id))) {
      throw new AppError("Invalid inventory ID format", 400);
    }

    // Find all inventory items and check for active assignments
    const inventoryItems = await prisma.productInventory.findMany({
      where: {
        id: { in: numericIds }
      },
      include: {
        assignments: { where: { returnedAt: null } }
      }
    });

    // Check if all items exist
    if (inventoryItems.length !== numericIds.length) {
      const foundIds = inventoryItems.map(item => item.id);
      const missingIds = numericIds.filter(id => !foundIds.includes(id));
      throw new AppError(`Inventory items not found: ${missingIds.join(', ')}`, 404);
    }

    // Check for assigned items
    const assignedItems = inventoryItems.filter(item => item.assignments.length > 0);
    if (assignedItems.length > 0) {
      throw new AppError(
        `Cannot delete assigned items: ${assignedItems.map(item => item.id).join(', ')}`, 
        400
      );
    }

    // Permanently delete all items in transaction (exactly like single delete)
    await prisma.$transaction(async (tx) => {
      // Delete related stock transactions
      await tx.stockTransaction.deleteMany({
        where: { inventoryId: { in: numericIds } }
      });

      // Delete related product assignments
      await tx.productAssignment.deleteMany({
        where: { inventoryId: { in: numericIds } }
      });

      // Finally delete all inventory items
      await tx.productInventory.deleteMany({
        where: { id: { in: numericIds } }
      });
    });

    res.json({
      success: true,
      message: `${inventoryIds.length} inventory item(s) deleted permanently`
    });

  } catch (error) {
    throw error;
  }
}