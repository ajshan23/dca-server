"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardData = getDashboardData;
const errorHandler_1 = require("../samples/errorHandler");
const db_1 = __importDefault(require("../database/db"));
const date_fns_1 = require("date-fns");
async function getDashboardData(_req, res) {
    try {
        // Get counts
        const [totalProducts, assignedProducts, totalCategories, totalBranches, totalEmployees] = await Promise.all([
            db_1.default.product.count({ where: { deletedAt: null } }),
            db_1.default.productAssignment.count({
                where: {
                    status: "ASSIGNED",
                    returnedAt: null,
                    product: { deletedAt: null }
                }
            }),
            db_1.default.category.count({ where: { deletedAt: null } }),
            db_1.default.branch.count({ where: { deletedAt: null } }),
            db_1.default.employee.count({ where: { deletedAt: null } })
        ]);
        // Weekly trend data
        const now = new Date();
        const weekStart = (0, date_fns_1.startOfWeek)(now);
        const weekEnd = (0, date_fns_1.endOfWeek)(now);
        const weeklyData = await Promise.all((0, date_fns_1.eachDayOfInterval)({ start: weekStart, end: weekEnd }).map(async (day) => {
            const dayStart = new Date(day);
            const dayEnd = new Date(day);
            dayEnd.setHours(23, 59, 59, 999);
            const assignments = await db_1.default.productAssignment.count({
                where: {
                    assignedAt: {
                        gte: dayStart,
                        lte: dayEnd
                    }
                }
            });
            return {
                day: (0, date_fns_1.format)(day, 'EEE'),
                assignments
            };
        }));
        // Recent activities
        const recentActivities = await db_1.default.productAssignment.findMany({
            take: 5,
            orderBy: {
                assignedAt: 'desc'
            },
            include: {
                product: {
                    select: {
                        name: true
                    }
                },
                employee: {
                    select: {
                        name: true
                    }
                }
            }
        });
        // Category distribution
        const categoryDistribution = await db_1.default.category.findMany({
            where: { deletedAt: null },
            select: {
                name: true,
                _count: {
                    select: {
                        products: true
                    }
                }
            }
        });
        res.json({
            success: true,
            data: {
                summary: {
                    products: totalProducts,
                    assigned: assignedProducts,
                    categories: totalCategories,
                    branches: totalBranches,
                    employees: totalEmployees
                },
                weeklyTrend: weeklyData,
                recentActivities,
                categoryDistribution
            }
        });
    }
    catch (error) {
        throw new errorHandler_1.AppError("Failed to fetch dashboard data", 500);
    }
}
//# sourceMappingURL=dashboardController.js.map