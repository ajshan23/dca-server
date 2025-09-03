import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../samples/errorHandler";
import prisma from "../database/db";

export async function authenticateJWT(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next(new AppError("Authorization header is required", 401));
    }

    const tokenParts = authHeader.split(" ");
    if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
      return next(new AppError("Invalid authorization header format", 401));
    }

    const token = tokenParts[1];

    jwt.verify(token, process.env.JWT_SECRET!, async (err, decoded) => {
      if (err) {
        return next(new AppError("Invalid or expired token", 403));
      }

      const payload = decoded as { userId: string; role: string; username: string };

      // 🔎 check user still exists and not deleted
      const user = await prisma.user.findUnique({
        where: { id: parseInt(payload.userId) },
        select: { id: true, username: true, role: true, deletedAt: true },
      });

      if (!user || user.deletedAt) {
        return next(new AppError("User not found or deleted", 404));
      }

      req.user = {
        userId: String(user.id),
        role: user.role,
        username: user.username,
      };

      return next();
    });
  } catch (error) {
    next(error);
  }
}
