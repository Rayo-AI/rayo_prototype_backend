import { AuthRepository } from "../repository/auth.ts";

export class AuthUseCase {
  static async signup(
    name: string, 
    email: string, 
    password: string | null, 
    googleData?: {
      googleId: string;
      googleEmail: string;
      profileImage?: string | null;
      emailVerified?: boolean; 
    }
  ) {
    const newUser = await AuthRepository.createUser(name, email, password, googleData);
    return newUser;
  }

  static async findUserByEmail(email: string) {
    const user = await AuthRepository.findUserByEmail(email);
    return user;
  }

  static async findUserById(id: number) {
    const user = await AuthRepository.findUserById(id)
    return user;
  }

  static async findUserByToken(token: string) {
    const user = await AuthRepository.findUserByToken(token);
    return user;
  }

  static async findUserByOTP(otp: string) {
    const user = await AuthRepository.findUserByOTP(otp);
    return user;
  }

  static async findUserByGoogleId(googleId: string) {
    const user = await AuthRepository.findUserByGoogleId(googleId);
    return user;
  }

  static async updateUserPassword(userId: number, passwordHash: string) {
    const user = await AuthRepository.updateUserPassword(userId, passwordHash);
    return user;
  }

  static async updateUser(
    userId: number, 
    data: {
      name?: string;
      envelopeBased?: boolean;
      resetToken?: string | null;
      resetTokenExpiry?: Date | null;
      emailVerified?: boolean;
      verificationOTP?: string | null;
      verificationOTPExpiry?: Date | null;
      googleId?: string;
      googleEmail?: string;
      profileImage?: string | null;
    }
  ) {
    const user = await AuthRepository.updateUser(userId, data);
    return user;
  }
}