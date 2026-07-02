"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    const username = 'admin';
    const password = 'admin123';
    const hashedPassword = await bcryptjs_1.default.hash(password, 10);
    const admin = await prisma.userProfile.upsert({
        where: { username },
        update: {
            password: hashedPassword,
            name: 'System Admin',
            role: client_1.Role.ADMIN,
            email: 'admin@tallyerp.com',
            isActive: true,
            pageAccess: ["dashboard", "companies", "company-data", "settings"],
        },
        create: {
            username,
            password: hashedPassword,
            name: 'System Admin',
            role: client_1.Role.ADMIN,
            email: 'admin@tallyerp.com',
            isActive: true,
            pageAccess: ["dashboard", "companies", "company-data", "settings"],
        },
    });
    console.log({ admin });
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
