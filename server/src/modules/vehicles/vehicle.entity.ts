import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("vehicles")
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  // Owner user (ADMIN or BROADCAST_MANAGER)
  @Column()
  ownerUserId: number;

  @Column()
  name: string;

  // API key used by the vehicle to authenticate WebRTC/broadcast
  @Column({ unique: true })
  apiKey: string;

  @Column({ default: false })
  isOnline: boolean;

  @Column({ type: "datetime", nullable: true })
  lastSeen: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
