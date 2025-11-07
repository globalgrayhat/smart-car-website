import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User, UserRole } from "./user.entity";
import * as bcrypt from "bcrypt";

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async createAdminIfNotExists(): Promise<void> {
    const adminEmail = "admin@smartcar.local";
    const exists = await this.repo.findOne({ where: { email: adminEmail } });

    if (!exists) {
      const user = this.repo.create({
        email: adminEmail,
        username: "admin",
        passwordHash: await bcrypt.hash("admin123", 10),
        role: UserRole.ADMIN,
      });
      await this.repo.save(user);
    }
  }

  async createUser(
    email: string,
    username: string,
    password: string,
    role: UserRole = UserRole.VIEWER,
  ): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    const entity = this.repo.create({ email, username, passwordHash, role });
    return this.repo.save(entity);
  }

  async all(): Promise<User[]> {
    return this.repo.find();
  }

  async updateRole(userId: number, role: UserRole) {
    await this.repo.update({ id: userId }, { role });
    return this.repo.findOne({ where: { id: userId } });
  }
}
