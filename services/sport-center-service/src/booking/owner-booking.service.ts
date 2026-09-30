import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificationService } from '../notification/notification.service';
import { PaymentTransactionService } from './payment-transaction.service';
import { BookingSelection } from './dto/booking-line-item.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { OwnerCreateBookingDto } from './dto/owner-create-booking.dto';

export interface PlayerInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

const SLOT_DURATION_MINUTES = 30;

@Injectable()
export class OwnerBookingService {
  private readonly logger = new Logger(OwnerBookingService.name);
  private readonly authServiceUrl: string;
  private readonly authInternalToken: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
    private readonly configService: ConfigService,
    private readonly paymentTransactions: PaymentTransactionService,
  ) {
    this.authServiceUrl =
      this.configService.get<string>('AUTH_SERVICE_URL') || 'http://auth-service:8001';
    this.authInternalToken =
      this.configService.get<string>('SERVICE_INTERNAL_TOKEN') || '';
  }

  private async fetchPlayerDetails(userIds: string[]): Promise<Map<string, PlayerInfo>> {
    if (userIds.length === 0) return new Map();

    const uniqueIds = Array.from(new Set(userIds));
    
    try {
      const url = `${this.authServiceUrl}/api/auth/internal/users/batch`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': this.authInternalToken,
        },
        body: JSON.stringify({ userIds: uniqueIds }),
      });

      if (!response.ok) {
        this.logger.error(`Failed to fetch players from auth service: ${response.statusText}`);
        return new Map();
      }

      const users: PlayerInfo[] = await response.json();
      const playerMap = new Map<string, PlayerInfo>();
      users.forEach(u => playerMap.set(u.id, u));
      return playerMap;
    } catch (error) {
      this.logger.error(`Error fetching player details: ${error}`);
      return new Map();
    }
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(mins: number): string {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  private normalizeSelections(
    selections:
      | Array<{ serviceId?: string; productId?: string; quantity?: number }>
      | undefined,
    legacyIds: string[] | undefined,
    idField: 'serviceId' | 'productId',
  ): BookingSelection[] {
    const merged = new Map<string, number>();

    for (const item of selections ?? []) {
      const id = item[idField];
      if (!id) {
        throw new BadRequestException('One or more booking items are missing an id');
      }
      const quantity = item.quantity ?? 1;
      merged.set(id, (merged.get(id) ?? 0) + quantity);
    }

    for (const id of legacyIds ?? []) {
      merged.set(id, (merged.get(id) ?? 0) + 1);
    }

    return Array.from(merged.entries()).map(([id, quantity]) => ({ id, quantity }));
  }

  private async getBookingServices(
    centerId: string,
    selections?: BookingSelection[],
    prisma: PrismaService | any = this.prisma,
  ) {
    if (!selections || selections.length === 0) {
      return { items: [], totalServicePrice: 0 };
    }

    const database: any = prisma;
    const serviceIds = selections.map(selection => selection.id);
    const services: any[] = await database.service.findMany({
      where: { id: { in: serviceIds }, centerId, isActive: true },
    });

    if (services.length !== serviceIds.length) {
      throw new BadRequestException('One or more services not found or inactive');
    }

    const serviceMap = new Map(services.map(service => [service.id, service]));
    const items = selections.map(selection => {
      const service = serviceMap.get(selection.id);
      if (!service) {
        throw new BadRequestException('One or more services not found or inactive');
      }

      const lineTotal = Number(service.price) * selection.quantity;

      return {
        id: service.id,
        name: service.name,
        price: Number(service.price),
        unit: service.unit,
        quantity: selection.quantity,
        lineTotal,
      };
    });

    const totalServicePrice = items.reduce((sum, item) => sum + item.lineTotal, 0);
    return { items, totalServicePrice };
  }

  private async getBookingProducts(
    centerId: string,
    selections?: BookingSelection[],
    prisma: PrismaService | any = this.prisma,
  ) {
    if (!selections || selections.length === 0) {
      return { items: [], totalProductPrice: 0 };
    }

    const database: any = prisma;
    const productIds = selections.map(selection => selection.id);
    const products: any[] = await database.product.findMany({
      where: { id: { in: productIds }, centerId, isActive: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products not found or inactive');
    }

    const productMap = new Map(products.map(product => [product.id, product]));
    const items = selections.map(selection => {
      const product = productMap.get(selection.id);
      if (!product) {
        throw new BadRequestException('One or more products not found or inactive');
      }

      if (product.stock < selection.quantity) {
        throw new BadRequestException(`Product ${product.name} is out of stock for the requested quantity`);
      }

      const lineTotal = Number(product.price) * selection.quantity;

      return {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        unit: product.unit,
        stock: product.stock,
        quantity: selection.quantity,
        lineTotal,
      };
    });

    const totalProductPrice = items.reduce((sum, item) => sum + item.lineTotal, 0);
    return { items, totalProductPrice };
  }

  async createBookingByOwner(ownerId: string, centerId: string, dto: OwnerCreateBookingDto) {
    const date = new Date(dto.date);
    const uniqueCourtIds = Array.from(new Set(dto.items.map(item => item.courtId)));

    const courts: any[] = await this.prisma.court.findMany({
      where: {
        id: { in: uniqueCourtIds },
        centerId,
        status: 'ACTIVE',
        center: { status: 'ACTIVE' },
      },
      include: { center: { include: { priceSlots: true } } },
    });

    if (courts.length !== uniqueCourtIds.length) {
      throw new NotFoundException('One or more courts are not available or not found');
    }

    const courtMap = new Map(courts.map(court => [court.id, court]));
    const requestRangesByCourt = new Map<string, Array<{ startMins: number; endMins: number }>>();
    const preparedItems: Array<{
      court: any;
      startTime: string;
      endTime: string;
      durationHours: number;
      breakdown: { startTime: string; endTime: string; pricePerHour: number }[];
      courtPrice: number;
    }> = [];

    for (const item of dto.items) {
      const court = courtMap.get(item.courtId);
      if (!court) {
        throw new NotFoundException('One or more courts are not available or not found');
      }

      if (court.center.ownerId !== ownerId) {
        throw new ForbiddenException('You do not own this sport center');
      }

      const startMins = this.timeToMinutes(item.startTime);
      const endMins = this.timeToMinutes(item.endTime);

      if (startMins >= endMins) {
        throw new BadRequestException('startTime must be before endTime');
      }
      if ((endMins - startMins) < SLOT_DURATION_MINUTES) {
        throw new BadRequestException(`Minimum booking duration is ${SLOT_DURATION_MINUTES} minutes`);
      }
      if ((endMins - startMins) % SLOT_DURATION_MINUTES !== 0) {
        throw new BadRequestException(`Booking duration must be a multiple of ${SLOT_DURATION_MINUTES} minutes`);
      }

      const openMins = this.timeToMinutes(court.center.openTime);
      const closeMins = this.timeToMinutes(court.center.closeTime);

      if (startMins < openMins || endMins > closeMins) {
        throw new BadRequestException('Booking time is outside center operating hours');
      }

      if (!requestRangesByCourt.has(item.courtId)) {
        requestRangesByCourt.set(item.courtId, []);
      }
      const existingRanges = requestRangesByCourt.get(item.courtId)!;
      const hasOverlapInRequest = existingRanges.some(
        range => startMins < range.endMins && endMins > range.startMins,
      );
      if (hasOverlapInRequest) {
        throw new BadRequestException('Requested slots contain overlapping time ranges on the same court');
      }
      existingRanges.push({ startMins, endMins });

      const overlaps = await this.prisma.bookingItem.findFirst({
        where: {
          courtId: item.courtId,
          booking: {
            date,
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
          AND: [{ startTime: { lt: item.endTime } }, { endTime: { gt: item.startTime } }],
        },
      });

      if (overlaps) {
        throw new ConflictException('Court is already booked for one or more selected time ranges');
      }

      const breakdown: { startTime: string; endTime: string; pricePerHour: number }[] = [];
      let courtPrice = 0;
      for (let m = startMins; m < endMins; m += SLOT_DURATION_MINUTES) {
        const priceSlot = court.center.priceSlots.find((ps: any) => {
          const psStart = this.timeToMinutes(ps.startTime);
          const psEnd = this.timeToMinutes(ps.endTime);
          return psStart <= m && psEnd >= (m + SLOT_DURATION_MINUTES);
        });

        const ratePerHour = priceSlot
          ? Number(priceSlot.pricePerHour)
          : Number(court.center.basePrice);

        breakdown.push({
          startTime: this.minutesToTime(m),
          endTime: this.minutesToTime(m + SLOT_DURATION_MINUTES),
          pricePerHour: ratePerHour,
        });
        courtPrice += ratePerHour * (SLOT_DURATION_MINUTES / 60);
      }

      preparedItems.push({
        court,
        startTime: item.startTime,
        endTime: item.endTime,
        durationHours: (endMins - startMins) / 60,
        breakdown,
        courtPrice,
      });
    }

    const serviceSelections = this.normalizeSelections(dto.serviceItems, dto.serviceIds, 'serviceId');
    const productSelections = this.normalizeSelections(dto.productItems, dto.productIds, 'productId');

    return this.prisma.$transaction(async (tx) => {
      const txDatabase: any = tx;
      const { items: services, totalServicePrice } = await this.getBookingServices(centerId, serviceSelections, tx);
      const { items: products, totalProductPrice } = await this.getBookingProducts(centerId, productSelections, tx);

      for (const product of products) {
        const totalQuantity = product.quantity * preparedItems.length;
        const updated = await txDatabase.product.updateMany({
          where: {
            id: product.id,
            centerId,
            isActive: true,
            stock: { gte: totalQuantity },
          },
          data: {
            stock: { decrement: totalQuantity },
          },
        });

        if (updated.count !== 1) {
          throw new BadRequestException(`Product ${product.name} is out of stock for the requested quantity`);
        }
      }

      const totalCourtPrice = preparedItems.reduce((sum, item) => sum + item.courtPrice, 0);
      const totalServicePriceAll = totalServicePrice * preparedItems.length;
      const totalProductPriceAll = totalProductPrice * preparedItems.length;
      const bookingTotalPrice = totalCourtPrice + totalServicePriceAll + totalProductPriceAll;

      const booking = await txDatabase.booking.create({
        data: {
          centerId,
          playerId: ownerId,
          playerName: dto.playerName,
          phoneNumber: dto.phoneNumber,
          date,
          status: 'CONFIRMED',
          totalPrice: bookingTotalPrice,
          note: dto.note,
          bookingItems: {
            create: preparedItems.map(item => ({
              courtId: item.court.id,
              startTime: item.startTime,
              endTime: item.endTime,
              itemPrice: item.courtPrice,
            })),
          },
          bookingServices: {
            create: services.map(service => ({
              serviceId: service.id,
              price: service.price,
              quantity: service.quantity * preparedItems.length,
            })),
          },
          bookingProducts: {
            create: products.map(product => ({
              productId: product.id,
              price: product.price,
              quantity: product.quantity * preparedItems.length,
            })),
          },
        } as any,
        include: {
          center: {
            select: {
              paymentAccountName: true,
              paymentAccountNumber: true,
              paymentBankName: true,
              paymentQrUrl: true,
            },
          },
          bookingItems: {
            include: { court: true },
          },
          bookingServices: {
            include: { service: true },
          },
          bookingProducts: {
            include: { product: true },
          },
        } as any,
      } as any);

      await this.paymentTransactions.recordCashPayment(
        tx,
        {
          id: booking.id,
          centerId: booking.centerId,
          playerId: booking.playerId,
          totalPrice: bookingTotalPrice,
        },
        bookingTotalPrice,
      );

      return {
        ...booking,
        bookingCount: preparedItems.length,
        items: preparedItems.map(item => ({
          courtId: item.court.id,
          courtName: item.court.name,
          startTime: item.startTime,
          endTime: item.endTime,
          durationHours: item.durationHours,
          breakdown: item.breakdown,
          courtPrice: item.courtPrice,
        })),
        totalCourtPrice,
        totalServicePrice: totalServicePriceAll,
        totalProductPrice: totalProductPriceAll,
        totalPrice: bookingTotalPrice,
      };
    });
  }

  async listCenterBookings(ownerId: string, centerId: string, query: ListBookingsQueryDto) {
    // 1. Verify owner owns the center
    const center = await this.prisma.sportCenter.findUnique({
      where: { id: centerId },
      select: { ownerId: true },
    });

    if (!center) throw new NotFoundException('Sport center not found');
    if (center.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this sport center');
    }

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const where: any = { centerId };

    if (query.status) where.status = query.status;
    if (query.courtId) where.bookingItems = { some: { courtId: query.courtId } };
    
    if (query.date) {
      where.date = new Date(query.date);
    } else {
      const dateConditions: any = {};
      if (query.startDate) dateConditions.gte = new Date(query.startDate);
      if (query.endDate) dateConditions.lte = new Date(query.endDate);

      if (query.timeFilter) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (query.timeFilter === 'PAST') {
          if (!dateConditions.lt || dateConditions.lt > today) {
            dateConditions.lt = today;
            delete dateConditions.lte;
          }
        } else if (query.timeFilter === 'FUTURE') {
          if (!dateConditions.gte || dateConditions.gte < today) {
            dateConditions.gte = today;
          }
        }
      }

      if (Object.keys(dateConditions).length > 0) {
        where.date = dateConditions;
      }
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          bookingItems: {
            include: {
              court: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          bookingServices: {
            include: { service: true },
          },
          bookingProducts: {
            include: { product: true },
          },
          center: true,
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    // Fetch player info
    const playerIds = data.map(b => b.playerId);
    const playerMap = await this.fetchPlayerDetails(playerIds);

    const mappedData = data.map(booking => {
      const authPlayer = playerMap.get(booking.playerId);
      const isOwnerBooking = booking.playerId === ownerId;

      return {
        ...booking,
        player: {
          id: booking.playerId,
          name: booking.playerName || authPlayer?.name || 'Unknown Player',
          email: isOwnerBooking ? undefined : authPlayer?.email,
          avatarUrl: isOwnerBooking ? undefined : authPlayer?.avatarUrl,
        },
      };
    });

    return { data: mappedData, pagination: { limit, offset, total } };
  }

  async getCenterBookingDetail(ownerId: string, centerId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        center: true,
        bookingItems: { include: { court: true } },
        bookingServices: { include: { service: true } },
        bookingProducts: { include: { product: true } },
      },
    });

    if (!booking || booking.centerId !== centerId) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.center.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this sport center');
    }

    const playerMap = await this.fetchPlayerDetails([booking.playerId]);
    const authPlayer = playerMap.get(booking.playerId);
    const isOwnerBooking = booking.playerId === ownerId;

    return {
      ...booking,
      player: {
        id: booking.playerId,
        name: booking.playerName || authPlayer?.name || 'Unknown Player',
        email: isOwnerBooking ? undefined : authPlayer?.email,
        avatarUrl: isOwnerBooking ? undefined : authPlayer?.avatarUrl,
      },
    };
  }

  async confirmBooking(ownerId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        center: { select: { id: true, ownerId: true, name: true } },
        bookingItems: { include: { court: true } },
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.center.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this sport center');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(`Booking is in ${booking.status} status and cannot be confirmed`);
    }

    const firstItem = booking.bookingItems?.[0];
    const startTimes = booking.bookingItems.map(item => item.startTime).sort();
    const endTimes = booking.bookingItems.map(item => item.endTime).sort();
    const detailsHtml = booking.bookingItems
      .map(item => `<li><strong>${item.court?.name ?? 'Court'}:</strong> ${item.startTime} - ${item.endTime}</li>`)
      .join('');

    const updated = await this.prisma.$transaction(async (tx) => {
      const confirmedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CONFIRMED },
      });

      await this.paymentTransactions.settleBankTransfer(tx, {
        id: booking.id,
        centerId: booking.centerId,
        playerId: booking.playerId,
        paymentRemaining: booking.paymentRemaining,
        paymentProofUrl: booking.paymentProofUrl,
      });

      return confirmedBooking;
    });

    // Send Notification
    try {
      if (booking.playerId) {
        // Fetch player details (email and name) for the notification
        const playerMap = await this.fetchPlayerDetails([booking.playerId]);
        const player = playerMap.get(booking.playerId);

        await this.notification.sendBookingConfirmedNotification(
          {
            playerId: booking.playerId,
            playerEmail: player?.email,
            playerName: player?.name,
            bookingId: booking.id,
            date: booking.date,
            startTime: startTimes[0] ?? '00:00',
            endTime: endTimes[endTimes.length - 1] ?? '00:00',
            bookingDetailsHtml: detailsHtml,
          },
          firstItem?.court?.name ?? 'Court',
          booking.center.name,
        );
      }
    } catch (e) {
      this.logger.error('Error handling notification', e);
    }

    return updated;
  }

  async completeBooking(ownerId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        center: { select: { id: true, ownerId: true } },
        bookingItems: true,
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.center.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this sport center');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(`Booking is in ${booking.status} status and cannot be completed. It must be CONFIRMED first.`);
    }

    const latestEnd = booking.bookingItems.map(item => item.endTime).sort().at(-1);
    const dateStr = booking.date.toISOString().split('T')[0];
    const endDateTime = new Date(`${dateStr}T${latestEnd ?? '00:00'}:00+07:00`);

    if (new Date() < endDateTime) {
      throw new BadRequestException('Cannot complete a booking before its end time has passed.');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.COMPLETED },
    });
  }
}
