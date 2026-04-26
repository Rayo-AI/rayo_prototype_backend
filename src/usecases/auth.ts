import { AuthRepository } from "../repository/auth.ts";

export class AuthUseCase {
  static async signup(name: string, email: string, password: string) {
    const newUser = await AuthRepository.createUser(name, email, password);
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

  static async updateUserPassword(userId: number, passwordHash: string) {
    const user = await AuthRepository.updateUserPassword(userId, passwordHash);
    return user;
  }

  static async updateUser(userValues: any) {
    const user = await AuthRepository.updateUser(userValues);
    return user;
  }
}