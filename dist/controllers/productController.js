"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProduct = createProduct;
exports.getAllProducts = getAllProducts;
exports.getProductById = getProductById;
exports.addStock = addStock;
exports.updateInventoryItem = updateInventoryItem;
exports.getAvailableInventory = getAvailableInventory;
exports.deleteInventoryItem = deleteInventoryItem;
exports.getStockTransactions = getStockTransactions;
exports.generateInventoryQr = generateInventoryQr;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
exports.getAssignedProducts = getAssignedProducts;
exports.getStockSummary = getStockSummary;
exports.generateProductQr = generateProductQr;
const errorHandler_1 = require("../samples/errorHandler");
const db_1 = __importDefault(require("../database/db"));
const qrcode_1 = __importDefault(require("qrcode"));
// Create a new product template
async function createProduct(req, res) {
    try {
        const { name, model, categoryId, branchId, departmentId, warrantyDuration, complianceStatus, description, minStockLevel, initialStock = 0, serialNumbers = [], purchaseDate, purchasePrice, location } = req.body;
        if (!name || !model || !categoryId || !branchId) {
            throw new errorHandler_1.AppError("Name, model, category and branch are required", 400);
        }
        // Validate references
        const [category, branch] = await Promise.all([
            db_1.default.category.findFirst({ where: { id: categoryId, deletedAt: null } }),
            db_1.default.branch.findFirst({ where: { id: branchId, deletedAt: null } })
        ]);
        if (!category)
            throw new errorHandler_1.AppError("Category not found", 404);
        if (!branch)
            throw new errorHandler_1.AppError("Branch not found", 404);
        if (departmentId) {
            const department = await db_1.default.department.findFirst({
                where: { id: departmentId, deletedAt: null }
            });
            if (!department)
                throw new errorHandler_1.AppError("Department not found", 404);
        }
        // Create product with initial inventory
        const result = await db_1.default.$transaction(async (tx) => {
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
    }
    catch (error) {
        throw error;
    }
}
// Get all products with stock information
async function getAllProducts(req, res) {
    try {
        const { page = 1, limit = 10, search, categoryId, branchId, departmentId, complianceStatus, stockStatus // NEW: Filter by stock status (low, out, available)
         } = req.query;
        const where = { deletedAt: null };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (categoryId)
            where.categoryId = parseInt(categoryId);
        if (branchId)
            where.branchId = parseInt(branchId);
        if (departmentId)
            where.departmentId = parseInt(departmentId);
        if (complianceStatus)
            where.complianceStatus = complianceStatus === 'true';
        const [products, total] = await Promise.all([
            db_1.default.product.findMany({
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
            db_1.default.product.count({ where })
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
    }
    catch (error) {
        throw new errorHandler_1.AppError("Failed to fetch products", 500);
    }
}
// Get product by ID with detailed stock information
async function getProductById(req, res) {
    try {
        const product = await db_1.default.product.findUnique({
            where: {
                id: parseInt(req.params.id),
                deletedAt: null
            },
            include: {
                category: { select: { id: true, name: true } },
                branch: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
                inventory: {
                    include: {
                        assignments: {
                            where: { returnedAt: null },
                            include: {
                                employee: { select: { id: true, name: true, empId: true } },
                                assignedBy: { select: { id: true, username: true } }
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                },
                assignments: {
                    orderBy: { assignedAt: 'desc' },
                    take: 10, // Recent assignments
                    include: {
                        inventory: { select: { id: true, serialNumber: true } },
                        employee: { select: { id: true, name: true, empId: true } },
                        assignedBy: { select: { id: true, username: true } }
                    }
                }
            }
        });
        if (!product)
            throw new errorHandler_1.AppError("Product not found", 404);
        // Calculate stock statistics
        const stockStats = {
            totalStock: product.inventory.length,
            availableStock: product.inventory.filter(item => item.status === 'AVAILABLE').length,
            assignedStock: product.inventory.filter(item => item.status === 'ASSIGNED').length,
            damagedStock: product.inventory.filter(item => item.status === 'DAMAGED').length,
            maintenanceStock: product.inventory.filter(item => item.status === 'MAINTENANCE').length,
            retiredStock: product.inventory.filter(item => item.status === 'RETIRED').length
        };
        res.json({
            success: true,
            data: {
                ...product,
                stockStats
            }
        });
    }
    catch (error) {
        throw error;
    }
}
// Add stock to existing product
async function addStock(req, res) {
    try {
        const { id } = req.params;
        const { quantity = 1, serialNumbers = [], purchaseDate, purchasePrice, location, condition = "NEW", reference, reason = "Stock replenishment" } = req.body;
        const product = await db_1.default.product.findUnique({
            where: { id: parseInt(id), deletedAt: null }
        });
        if (!product)
            throw new errorHandler_1.AppError("Product not found", 404);
        const result = await db_1.default.$transaction(async (tx) => {
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
                        throw new errorHandler_1.AppError(`Serial number ${serialNumber} already exists`, 409);
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
    }
    catch (error) {
        throw error;
    }
}
// Update inventory item
async function updateInventoryItem(req, res) {
    try {
        const { inventoryId } = req.params;
        const { status, condition, location, notes, serialNumber, warrantyExpiry, reason = "Manual update" } = req.body;
        const inventoryItem = await db_1.default.productInventory.findUnique({
            where: { id: parseInt(inventoryId) },
            include: {
                assignments: { where: { returnedAt: null } }
            }
        });
        if (!inventoryItem)
            throw new errorHandler_1.AppError("Inventory item not found", 404);
        // Prevent status change if item is currently assigned
        if (inventoryItem.assignments.length > 0 && status && status !== inventoryItem.status) {
            throw new errorHandler_1.AppError("Cannot change status of assigned item", 400);
        }
        const updatedItem = await db_1.default.$transaction(async (tx) => {
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
    }
    catch (error) {
        throw error;
    }
}
// Get available inventory for assignment
async function getAvailableInventory(req, res) {
    try {
        const { productId } = req.params;
        const availableItems = await db_1.default.productInventory.findMany({
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
    }
    catch (error) {
        throw new errorHandler_1.AppError("Failed to fetch available inventory", 500);
    }
}
// Delete/Retire inventory item
async function deleteInventoryItem(req, res) {
    try {
        const { inventoryId } = req.params;
        const { reason = "Item retired", permanent = false } = req.body;
        const inventoryItem = await db_1.default.productInventory.findUnique({
            where: { id: parseInt(inventoryId) },
            include: {
                assignments: { where: { returnedAt: null } }
            }
        });
        if (!inventoryItem)
            throw new errorHandler_1.AppError("Inventory item not found", 404);
        if (inventoryItem.assignments.length > 0) {
            throw new errorHandler_1.AppError("Cannot delete assigned item", 400);
        }
        await db_1.default.$transaction(async (tx) => {
            if (permanent) {
                // Permanently delete (soft delete)
                await tx.productInventory.update({
                    where: { id: parseInt(inventoryId) },
                    data: {
                        deletedAt: new Date(),
                        status: "RETIRED"
                    }
                });
            }
            else {
                // Just mark as retired
                await tx.productInventory.update({
                    where: { id: parseInt(inventoryId) },
                    data: { status: "RETIRED" }
                });
            }
            // Create transaction record
            await tx.stockTransaction.create({
                data: {
                    inventoryId: parseInt(inventoryId),
                    type: permanent ? "OUT" : "RETIRED",
                    quantity: 1,
                    reason,
                    reference: `DEL-${Date.now()}`
                }
            });
        });
        res.json({
            success: true,
            message: permanent ? "Inventory item deleted permanently" : "Inventory item retired"
        });
    }
    catch (error) {
        throw error;
    }
}
// Get stock transactions/history
async function getStockTransactions(req, res) {
    try {
        const { page = 1, limit = 10, productId, inventoryId, type, fromDate, toDate } = req.query;
        const where = {};
        if (productId) {
            where.inventory = { productId: parseInt(productId) };
        }
        if (inventoryId)
            where.inventoryId = parseInt(inventoryId);
        if (type)
            where.type = type;
        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate)
                where.createdAt.gte = new Date(fromDate);
            if (toDate)
                where.createdAt.lte = new Date(toDate);
        }
        const [transactions, total] = await Promise.all([
            db_1.default.stockTransaction.findMany({
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
            db_1.default.stockTransaction.count({ where })
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
    }
    catch (error) {
        throw new errorHandler_1.AppError("Failed to fetch stock transactions", 500);
    }
}
// Generate QR code for inventory item
async function generateInventoryQr(req, res) {
    try {
        const { inventoryId } = req.params;
        if (!inventoryId || isNaN(parseInt(inventoryId))) {
            throw new Error("Invalid inventory ID");
        }
        const inventoryItem = await db_1.default.productInventory.findUnique({
            where: { id: parseInt(inventoryId) },
            include: { product: true }
        });
        if (!inventoryItem)
            throw new errorHandler_1.AppError("Inventory item not found", 404);
        const itemUrl = `${process.env.FRONTEND_URL}/inventory-view/${inventoryId}`;
        const qrCode = await new Promise((resolve, reject) => {
            qrcode_1.default.toDataURL(itemUrl, {
                errorCorrectionLevel: 'H',
                width: 300,
                margin: 1
            }, (err, url) => {
                if (err)
                    return reject(err);
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
    }
    catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to generate QR code'
        });
    }
}
// Legacy function - kept for backward compatibility
async function updateProduct(req, res) {
    try {
        const { id } = req.params;
        const { name, model, categoryId, branchId, departmentId, warrantyDuration, complianceStatus, description, minStockLevel } = req.body;
        const product = await db_1.default.product.findUnique({
            where: { id: parseInt(id) }
        });
        if (!product)
            throw new errorHandler_1.AppError("Product not found", 404);
        // Validate references if changed
        if (categoryId && categoryId !== product.categoryId) {
            const category = await db_1.default.category.findFirst({
                where: { id: categoryId, deletedAt: null }
            });
            if (!category)
                throw new errorHandler_1.AppError("Category not found", 404);
        }
        if (branchId && branchId !== product.branchId) {
            const branch = await db_1.default.branch.findFirst({
                where: { id: branchId, deletedAt: null }
            });
            if (!branch)
                throw new errorHandler_1.AppError("Branch not found", 404);
        }
        if (departmentId && departmentId !== product.departmentId) {
            const department = await db_1.default.department.findFirst({
                where: { id: departmentId, deletedAt: null }
            });
            if (!department)
                throw new errorHandler_1.AppError("Department not found", 404);
        }
        const updatedProduct = await db_1.default.product.update({
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
    }
    catch (error) {
        throw error;
    }
}
// Legacy function - kept for backward compatibility
async function deleteProduct(req, res) {
    try {
        const { id } = req.params;
        const product = await db_1.default.product.findUnique({
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
        if (!product)
            throw new errorHandler_1.AppError("Product not found", 404);
        if (product._count.assignments > 0) {
            throw new errorHandler_1.AppError("Cannot delete product with active assignments", 400);
        }
        await db_1.default.$transaction(async (tx) => {
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
    }
    catch (error) {
        throw error;
    }
}
// Legacy function - kept for backward compatibility but now shows assigned inventory
async function getAssignedProducts(_req, res) {
    try {
        const products = await db_1.default.product.findMany({
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
    }
    catch (error) {
        throw new errorHandler_1.AppError("Failed to fetch assigned products", 500);
    }
}
// New function to get stock dashboard/summary
async function getStockSummary(_req, res) {
    try {
        const summary = await db_1.default.$transaction(async (tx) => {
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
            const actualLowStock = lowStockProducts.filter(product => product._count.inventory <= product.minStockLevel);
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
                }, {}),
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
    }
    catch (error) {
        console.error('Stock summary error:', error);
        throw new errorHandler_1.AppError("Failed to fetch stock summary", 500);
    }
}
// Legacy QR generation - now generates for product template
async function generateProductQr(req, res) {
    try {
        const { id } = req.params;
        if (!id || isNaN(parseInt(id))) {
            throw new Error("Invalid product ID");
        }
        const productUrl = `${process.env.FRONTEND_URL}/products-view/${id}`;
        const qrCode = await new Promise((resolve, reject) => {
            qrcode_1.default.toDataURL(productUrl, {
                errorCorrectionLevel: 'H',
                width: 300,
                margin: 1
            }, (err, url) => {
                if (err)
                    return reject(err);
                resolve(url);
            });
        });
        res.json({
            success: true,
            qrCode
        });
    }
    catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to generate QR code'
        });
    }
}
//# sourceMappingURL=productController.js.map