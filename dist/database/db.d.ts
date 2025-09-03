import { PrismaClient } from "@prisma/client";
declare const prisma: PrismaClient<{
    log: ("info" | "query" | "warn" | "error")[];
    datasources: {
        db: {
            url: string;
        };
    };
}, never, import("@prisma/client/runtime/library").DefaultArgs>;
export default prisma;
