import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

export enum InviteStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

@Entity("broadcast_invites")
export class BroadcastInvite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sessionId: number;

  @Column()
  fromUserId: number;

  @Column()
  toUserId: number;

  @Column()
  token: string;

  @Column({
    type: "enum",
    enum: InviteStatus,
    default: InviteStatus.PENDING,
  })
  status: InviteStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: "datetime", nullable: true })
  expiresAt: Date | null;
}
