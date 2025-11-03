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

  @Column()
  ownerUserId: number;

  @Column()
  name: string;

  @Column({ unique: true })
  apiKey: string;

  @Column({ default: false })
  isOnline: boolean;

  @Column({ type: "datetime", nullable: true })
  lastSeen: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
