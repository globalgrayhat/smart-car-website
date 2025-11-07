// server/src/modules/join-requests/join-request.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum JoinRequestIntent {
  VIEW = 'VIEW',
  CAMERA = 'CAMERA',
  SCREEN = 'SCREEN',
  CONTROL = 'CONTROL',
}

export enum JoinRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export type JoinIntent = keyof typeof JoinRequestIntent;   // 'VIEW' | 'CAMERA' | ...
export type JoinStatus = keyof typeof JoinRequestStatus;   // 'PENDING' | ...

@Entity('join_requests')
@Index(['fromUserId', 'toUserId', 'intent'])
export class JoinRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fromUserId: number;

  @Column()
  toUserId: number;

  @Column({ type: 'varchar', length: 16 })
  intent: JoinIntent;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status: JoinStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
