import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
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
  session: BroadcastSession;

  @Column()
  sessionId: number;

  @Column()
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

  // mediasoup producer id OR external stream id
  @Column({ nullable: true })
  externalId: string | null;

  // socket id of owner (if online)
  @Column({ nullable: true })
  ownerSocketId: string | null;

  @Column({ type: "json", nullable: true })
  meta: any;
}
