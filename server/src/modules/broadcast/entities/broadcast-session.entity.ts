import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from "typeorm";
import { BroadcastSource } from "./broadcast-source.entity";

export enum BroadcastSessionStatus {
  ACTIVE = "ACTIVE",
  ENDED = "ENDED",
  PAUSED = "PAUSED",
}

@Entity("broadcast_sessions")
export class BroadcastSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: "Default session" })
  title: string;

  @Column()
  ownerUserId: number;

  @Column({
    type: "enum",
    enum: BroadcastSessionStatus,
    default: BroadcastSessionStatus.ACTIVE,
  })
  status: BroadcastSessionStatus;

  @OneToMany(() => BroadcastSource, (s) => s.session, { cascade: true })
  sources: BroadcastSource[];

  @CreateDateColumn()
  createdAt: Date;
}
