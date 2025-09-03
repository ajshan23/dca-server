"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
exports.updateSuperAdminRole = updateSuperAdminRole;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = __importDefault(require("./db"));
async function main() {
    const superadminEmail = 'superadmin';
    const superadminPassword = 'SuperAdmin@1234';
    // Hash the password
    const hashedPassword = await bcryptjs_1.default.hash(superadminPassword, 12);
    // Check if superadmin already exists
    const existingSuperadmin = await db_1.default.user.findFirst({
        where: {
            OR: [
                { username: superadminEmail },
                { role: 'super_admin' }
            ]
        }
    });
    if (existingSuperadmin) {
        console.log('Superadmin already exists:', existingSuperadmin);
        return;
    }
    // Create superadmin
    const superadmin = await db_1.default.user.create({
        data: {
            username: superadminEmail,
            passwordHash: hashedPassword,
            role: 'super_admin',
            createdAt: new Date(),
            updatedAt: new Date()
        }
    });
    console.log('Created superadmin:', {
        id: superadmin.id,
        username: superadmin.username,
        role: superadmin.role
    });
}
async function updateSuperAdminRole() {
    const result = await db_1.default.user.updateMany({
        where: {
            role: 'SUPER_ADMIN',
        },
        data: {
            role: 'super_admin',
        },
    });
    console.log(`${result.count} user(s) updated.`);
}
//# sourceMappingURL=seed.js.map