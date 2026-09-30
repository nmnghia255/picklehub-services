import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';

export type GroupSummary = {
  id: string;
  name: string;
  maxMembers?: number;
  memberCount?: number;
};

export type GroupMembership = {
  isMember: boolean;
  role: 'OWNER' | 'MEMBER';
};

export type GroupAccess = {
  canAccess: boolean;
  role: 'OWNER' | 'MEMBER';
  group: GroupSummary & {
    status?: string;
  };
};

@Injectable()
export class GroupClient {
  private readonly internalHeader = 'x-internal-token';

  private get groupServiceUrl() {
    return process.env.GROUP_SERVICE_URL ?? 'http://localhost:8003';
  }

  private get groupInternalToken() {
    return process.env.SERVICE_INTERNAL_TOKEN ?? '';
  }

  async getGroup(groupId: string): Promise<GroupSummary> {
    const response = await axios.get(`${this.groupServiceUrl}/internal/groups/${groupId}`, {
      headers: { [this.internalHeader]: this.groupInternalToken },
      validateStatus: () => true,
    });

    if (response.status === 404) throw new NotFoundException('Group not found');
    if (response.status >= 400) throw new ForbiddenException('Unable to access group');
    return response.data as GroupSummary;
  }

  async assertMember(groupId: string, userId: string): Promise<GroupMembership> {
    const response = await axios.get(
      `${this.groupServiceUrl}/internal/groups/${groupId}/members/${userId}`,
      {
        headers: { [this.internalHeader]: this.groupInternalToken },
        validateStatus: () => true,
      },
    );

    if (response.status === 404) {
      throw new ForbiddenException('You are not a member of this group');
    }

    if (response.status >= 400) {
      throw new ForbiddenException('Unable to verify group membership');
    }

    return response.data as GroupMembership;
  }

  async assertGroupAccess(groupId: string, userId: string): Promise<GroupAccess> {
    const response = await axios.get(
      `${this.groupServiceUrl}/internal/groups/${groupId}/access/${userId}`,
      {
        headers: { [this.internalHeader]: this.groupInternalToken },
        validateStatus: () => true,
      },
    );

    if (response.status === 404) {
      throw new NotFoundException('Group not found');
    }

    if (response.status === 403) {
      throw new ForbiddenException('You are not a member of this group');
    }

    if (response.status >= 400) {
      throw new ForbiddenException('Unable to verify group chat access');
    }

    return response.data as GroupAccess;
  }
}
