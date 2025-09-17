import { PrismaClient } from "@prisma/client"
import config from "../config"

const prisma = new PrismaClient({
  log: config.db.logging ? ["query", "info", "warn", "error"] : ["warn", "error"],
  datasources: {
    db: {
      url: config.db.url,
    },
  },
})

export default prisma
