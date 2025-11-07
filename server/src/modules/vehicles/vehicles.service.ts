import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Vehicle } from "./vehicle.entity";
import { randomBytes } from "crypto";

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly repo: Repository<Vehicle>,
  ) {}

  async listForUser(userId: number) {
    return this.repo.find({ where: { ownerUserId: userId } });
  }

  async registerVehicle(userId: number, name: string) {
    const apiKey = randomBytes(24).toString("hex");
    const entity = this.repo.create({ ownerUserId: userId, name, apiKey });
    return this.repo.save(entity);
  }

  async heartbeat(apiKey: string) {
    const v = await this.repo.findOne({ where: { apiKey } });
    if (!v) return null;

    v.isOnline = true;
    v.lastSeen = new Date();
    return this.repo.save(v);
  }

  async findByApiKey(apiKey: string): Promise<Vehicle | null> {
    return this.repo.findOne({ where: { apiKey } });
  }
}
