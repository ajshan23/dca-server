import { Request, Response, NextFunction } from "express";
import { ObjectSchema } from "joi";
export declare function validateRequest(schema: ObjectSchema): (req: Request, _res: Response, next: NextFunction) => void;
