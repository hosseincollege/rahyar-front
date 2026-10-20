//src/types/auth.ts


export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface AuthResponseUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  role?: string;
  organizationId?: string | null;
}

export interface AuthResponse {
  access_token: string;
  user: AuthResponseUser;
}

export interface UserPayload {
  sub: string;
  username?: string;
  email?: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export type UserRole =
  | 'ADMIN'
  | 'MANAGER'
  | 'SUPPORT'
  | 'TECHNICIAN'
  | 'CUSTOMER'
  | 'USER';
