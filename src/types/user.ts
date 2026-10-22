export interface User {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly timezone: string;
  readonly createdAt: Date;
}

export interface CreateUserInput {
  readonly email: string;
  readonly displayName: string;
  readonly timezone?: string;
}

export interface AuthenticatedActor {
  readonly userId: string;
  readonly scopes: readonly string[];
}