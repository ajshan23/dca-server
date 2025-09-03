import { PrismaClient } from "@prisma/client";
import config from "../config";

const prisma = new PrismaClient({
  log: config.db.logging ? ["query", "info", "warn", "error"] : ["warn", "error"],
  datasources: {
    db: {
      url: config.db.url
    }
  }
});

// Soft delete middleware
prisma.$use(async (params: any, next: any) => {
  // Check incoming query type
  if (params.action === 'delete') {
    // Delete queries
    // Change action to an update
    params.action = 'update'
    params.args.data = { deletedAt: new Date() }
  }
  if (params.action === 'deleteMany') {
    // Delete many queries
    params.action = 'updateMany'
    if (params.args.data !== undefined) {
      params.args.data.deletedAt = new Date()
    } else {
      params.args.data = { deletedAt: new Date() }
    }
  }

  // Filter out deleted records for find methods
  if (params.action === 'findUnique' || params.action === 'findFirst') {
    // Add filter for deletedAt
    params.args.where.deletedAt = null
  }
  if (params.action === 'findMany') {
    // Find many queries
    if (params.args.where) {
      if (params.args.where.deletedAt === undefined) {
        // Exclude deleted records if they haven't been explicitly requested
        params.args.where.deletedAt = null
      }
    } else {
      params.args.where = { deletedAt: null }
    }
  }

  return next(params)
});

export default prisma;