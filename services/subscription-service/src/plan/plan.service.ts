import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ListPlansQueryDto } from './dto/list-plans.query.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlanService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListPlansQueryDto, userId?: string) {
    const plans = await this.prisma.plan.findMany({
      where: {
        isActive: true,
        ...(query.type && { type: query.type }),
        ...(query.billingCycle && { billingCycle: query.billingCycle }),
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (!userId) return plans;
    return this.enrichWithSubscriptionStatus(plans, userId);
  }

  async findOne(id: string, userId?: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    
    if (!userId) return plan;
    const [enriched] = await this.enrichWithSubscriptionStatus([plan], userId);
    return enriched;
  }

  async update(id: string, dto: UpdatePlanDto) {
    await this.findOne(id); // throws 404 if not found
    return this.prisma.plan.update({ where: { id }, data: dto });
  }

  private async enrichWithSubscriptionStatus(plans: any[], userId: string) {
    const planIds = plans.map((p) => p.id);
    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        planId: { in: planIds },
      },
    });

    const activePlanIds = new Set(activeSubscriptions.map((s) => s.planId));

    return plans.map((plan) => ({
      ...plan,
      isSubscribed: activePlanIds.has(plan.id),
    }));
  }
}
