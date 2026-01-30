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
