import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { userRepository } from "../../db/repositories/userRepository.js";
import type { CreateUserInput, User } from "../../types/user.js";

export function createUserService(repository: typeof userRepository = userRepository) {
  return {
    async get(id: string): Promise<User> {
      const user = await repository.findById(id);
      if (!user) throw new NotFoundError("User", id);
      return user;
    },

    async register(input: CreateUserInput): Promise<User> {
      const existing = await repository.findByEmail(input.email);
      if (existing) {
        throw new ConflictError("A user with that email already exists", {
          email: input.email,
        });
      }
      return repository.create(input);
    },

    async remove(id: string): Promise<void> {
      await this.get(id);
      await repository.delete(id);
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;
export const userService = createUserService();