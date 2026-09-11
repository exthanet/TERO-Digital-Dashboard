export type UserRole = "admin" | "viewer" | "editor";

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface UserRecord extends User {
  passwordHash: string; // Stored hash or base64/hashed string
}

export interface AuthSession {
  user: User;
  token: string;
  loginAt: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  name: string;
  password: string;
  role?: UserRole;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}
