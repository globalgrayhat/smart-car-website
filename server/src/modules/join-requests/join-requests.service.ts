import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  JoinRequest,
  JoinIntent,
  JoinStatus,
} from './join-request.entity';

@Injectable()
export class JoinRequestsService {
  constructor(
    @InjectRepository(JoinRequest)
    private readonly repo: Repository<JoinRequest>,
  ) {}

  /**
   * Create a new join request from one user to another.
   */
  async create(
    fromUserId: number,
    toUserId: number,
    intent: JoinIntent,
    message?: string,
  ): Promise<JoinRequest> {
    if (fromUserId === toUserId) {
      throw new ForbiddenException('You cannot send a request to yourself');
    }

    const jr = this.repo.create({
      fromUserId,
      toUserId,
      intent,
      message: message || null,
      status: 'PENDING',
    });

    await this.repo.save(jr);
    return jr;
  }

  /**
   * Get all join requests for a specific owner (toUserId).
   */
  async getForOwner(ownerId: number): Promise<JoinRequest[]> {
    return this.repo.find({
      where: { toUserId: ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get the latest join request between fromUserId and toUserId.
   */
  async getLastForPair(
    fromUserId: number,
    toUserId: number,
  ): Promise<JoinRequest | null> {
    return this.repo.findOne({
      where: { fromUserId, toUserId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update the status (APPROVED / REJECTED) of a join request.
   * Only the target owner (toUserId) may update it.
   */
  async setStatus(
    id: number,
    ownerId: number,
    status: JoinStatus,
  ): Promise<JoinRequest> {
    const jr = await this.repo.findOne({ where: { id } });
    if (!jr) {
      throw new NotFoundException('Join request not found');
    }
    if (jr.toUserId !== ownerId) {
      throw new ForbiddenException(
        'You are not allowed to update this join request',
      );
    }

    jr.status = status;
    return this.repo.save(jr);
  }

  /**
   * Check if a viewer user has an APPROVED join request
   * that allows sending media (CAMERA, SCREEN, CONTROL).
   *
   * - viewerUserId: the user attempting to send media (fromUserId).
   * - ownerUserId (optional): if provided, restricts to requests towards that owner (toUserId).
   */
  async hasApprovedCameraOrUpgrade(
    viewerUserId: number,
    ownerUserId?: number,
  ): Promise<boolean> {
    const where: any = {
      fromUserId: viewerUserId,
      status: 'APPROVED' as JoinStatus,
      intent: In<JoinIntent>(['CAMERA', 'SCREEN', 'CONTROL']),
    };

    if (ownerUserId) {
      where.toUserId = ownerUserId;
    }

    const jr = await this.repo.findOne({
      where,
      order: { createdAt: 'DESC' },
    });

    return !!jr;
  }
}
