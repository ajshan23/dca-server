// validationMiddleware.ts
import { Request, Response, NextFunction } from "express";
import { ObjectSchema } from "joi";
import { AppError } from "../samples/errorHandler";

export function validateRequest(schema: ObjectSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return next(new AppError(error.details[0].message, 400));
    }
    next();
  };
}