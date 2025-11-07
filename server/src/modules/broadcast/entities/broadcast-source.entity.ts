// server/src/modules/broadcast/entities/broadcast-source.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { BroadcastSession } from "./broadcast-session.entity";

export enum BroadcastSourceType {
  SCREEN = "SCREEN",
  HOST_CAMERA = "HOST_CAMERA",
  CAR_CAMERA = "CAR_CAMERA",
  GUEST_CAMERA = "GUEST_CAMERA",
}

@Entity("broadcast_sources")
export class BroadcastSource {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BroadcastSession, (s) => s.sources, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "sessionId" })
  session: BroadcastSession;

  @Column()
  sessionId: number;

  @Column({ length: 191 })
  name: string;

  @Column({
    type: "enum",
    enum: BroadcastSourceType,
  })
  type: BroadcastSourceType;

  @Column({ default: false })
  isOnAir: boolean;

  @Column({ default: false })
  isMuted: boolean;

  @Column({ nullable: true, length: 191 })
  externalId: string | null;

  @Column({ nullable: true, length: 191 })
  ownerSocketId: string | null;

  // نخزن JSON كنص لتفادي مشكلة Row size
  @Column({
    type: "text",
    nullable: true,
    transformer: {
      to: (value?: any) =>
        value === undefined || value === null ? null : JSON.stringify(value),
      from: (value?: string | null) =>
        !value ? null : JSON.parse(value),
    },
  })
  meta: any | null;
}
