import type { ApiFailure, ApiSuccess } from "@/lib/types/api";

export type AuthStatus = "authenticated" | "confirmation_required";

export type AuthResult = { status: AuthStatus };

export type SignInResponse = ApiSuccess<AuthResult> | ApiFailure;
export type SignUpResponse = ApiSuccess<AuthResult> | ApiFailure;
