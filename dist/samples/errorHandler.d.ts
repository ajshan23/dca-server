import { NextFunction, Response, Request } from "express";
export declare class AppError extends Error {
    message: string;
    statusCode: number;
    isOperational: boolean;
    constructor(message: string, statusCode?: number, isOperational?: boolean);
}
export declare function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void;
