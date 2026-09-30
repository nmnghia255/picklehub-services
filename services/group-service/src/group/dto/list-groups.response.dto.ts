export type GroupRoleResponse = 'owner' | 'admin' | 'member';

export type GroupStatusResponse = 'ACTIVE' | 'GRACE_PERIOD' | 'FROZEN' | 'ARCHIVED';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface GroupListItem {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  maxMembers: number;
  memberCount: number;
  status: GroupStatusResponse;
  createdAt: Date;
}

export interface AdminGroupListItem extends GroupListItem {
  role: null;
}

export interface MyGroupListItem extends GroupListItem {
  role: GroupRoleResponse;
}
