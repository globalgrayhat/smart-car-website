import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum JoinRequestStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

@Entity("join_requests")
export class JoinRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fromUserId: number;

  @Column()
  toUserId: number;

  @Column({ nullable: true })
  message: string | null;

  @Column({
    type: "varchar",
    length: 32,
    default: "VIEW",
  })
  intent: "VIEW" | "CAMERA" | "ROLE_UPGRADE";

  @Column({
    type: "enum",
    enum: JoinRequestStatus,
    default: JoinRequestStatus.PENDING,
  })
  status: JoinRequestStatus;

  @Column({ nullable: true })
  grantedRole: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
