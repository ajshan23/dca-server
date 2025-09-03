import { Request, Response } from "express";
import { AppError } from "../samples/errorHandler";
import prisma from "../database/db";
import { startOfWeek, endOfWeek, eachDayOfInterval, format } from "date-fns";

export async function getDashboardData(_req: Request, res: Response) {
  try {
    // Get counts
    const [totalProducts, assignedProducts, totalCategories, totalBranches, totalEmployees] = await Promise.all([
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.productAssignment.count({ 
        where: { 
          status: "ASSIGNED",
          returnedAt: null,
          product: { deletedAt: null }
        } 
      }),
      prisma.category.count({ where: { deletedAt: null } }),
      prisma.branch.count({ where: { deletedAt: null } }),
      prisma.employee.count({ where: { deletedAt: null } })
    ]);

    // Weekly trend data
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    
    const weeklyData = await Promise.all(
      eachDayOfInterval({ start: weekStart, end: weekEnd }).map(async day => {
        const dayStart = new Date(day);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        const assignments = await prisma.productAssignment.count({
          where: {
            assignedAt: {
              gte: dayStart,
              lte: dayEnd
            }
          }
        });

        return {
          day: format(day, 'EEE'),
          assignments
        };
      })
    );

    // Recent activities
    const recentActivities = await prisma.productAssignment.findMany({
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
    const categoryDistribution = await prisma.category.findMany({
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
  } catch (error) {
    throw new AppError("Failed to fetch dashboard data", 500);
  }
}