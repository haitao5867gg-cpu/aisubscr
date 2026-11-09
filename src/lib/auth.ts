import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { normalizeEmail } from "./email";

export { normalizeEmail } from "./email";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createUser(email: string, password: string, name?: string, role = "USER") {
  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: { email: normalizeEmail(email), passwordHash, name: name || null, role },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
}
