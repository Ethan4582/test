import { prisma } from "../client.js";
import type { CreateUserInput, User } from "../../types/user.js";

export const userRepository = {
  async create(input: CreateUserInput): Promise<User> {
    return prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        displayName: input.displayName,
        timezone: input.timezone ?? "UTC",
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        timezone: true,
        createdAt: true,
      },
    });
  },

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        displayName: true,
        timezone: true,
        createdAt: true,
      },
    });
  },

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        displayName: true,
        timezone: true,
        createdAt: true,
      },
    });
  },

  async delete(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  },
};