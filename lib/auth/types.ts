export type UserRole = "admin" | "viewer";

/** Profile stored in Firestore at users/{uid}; the password lives in Firebase Auth. */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface NewUserData {
  email: string;
  name: string;
  role: UserRole;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface LoginEvent {
  id: string;
  uid: string;
  email: string;
  name: string;
  at: string;
}

export type AuthResult = { success: boolean; error?: string };
