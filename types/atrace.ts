export interface Member {
  id: string
  userId: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PlanLimits {
  max_posts?: number
  max_employees?: number
  [key: string]: any
}

export type AtracePostLocation = {
  comment?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
};

export type Post = {
  id: string;
  title: string;
  description?: string | null;
  location?: AtracePostLocation | null;
  phrase?: string;
};

export type RouteProgressRow = {
  userId: string;
  username: string;
  email: string;
  lastDate: string | null;
  lastStatus: string | null;
  completedCount: number;
  partialCount: number;
  violatedCount: number;
  pendingCount: number;
};
