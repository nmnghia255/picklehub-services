import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { BookingCancelReason } from './booking-cancel-reason';
import { BOOKING_TIMEOUT_MINUTES } from './booking-timeout.service';
import { CreditService } from './credit.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { LinkPlaySessionDto } from './dto/link-play-session.dto';
import { PreviewBookingDto } from './dto/preview-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { UnlinkPlaySessionDto } from './dto/unlink-play-session.dto';
import { PaymentTransactionService } from './payment-transaction.service';
import {
  BookingSelection,
} from './dto/booking-line-item.dto';

const SLOT_DURATION_MINUTES = 30;

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
    private readonly paymentTransactions: PaymentTransactionService,
  ) {}

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
    prisma: PrismaService | Prisma.TransactionClient = this.prisma,
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
    prisma: PrismaService | Prisma.TransactionClient = this.prisma,
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

  async getAvailability(centerId: string, courtId: string, dateStr: string) {
    const court = await this.prisma.court.findFirst({
      where: { id: courtId, centerId, status: 'ACTIVE', center: { status: 'ACTIVE' } },
      include: { center: { include: { priceSlots: true } } },
    });

    if (!court) {
      throw new NotFoundException('Court is not available or not found');
    }

    const date = new Date(dateStr);

    // Get existing booking items for the day
    const bookingItems = await (this.prisma as any).bookingItem.findMany({
      where: {
        courtId,
        booking: {
          date,
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
      },
      select: { startTime: true, endTime: true },
    });

    const openMins = this.timeToMinutes(court.center.openTime);
    const closeMins = this.timeToMinutes(court.center.closeTime);

    const slots = [];
    const now = new Date();

    for (let m = openMins; m < closeMins; m += SLOT_DURATION_MINUTES) {
      const slotStart = this.minutesToTime(m);
      const slotEnd = this.minutesToTime(m + SLOT_DURATION_MINUTES);

      const slotStartDateTime = new Date(`${dateStr}T${slotStart}:00+07:00`);
      const isPast = slotStartDateTime < now;

      // Check if booked
      const isBooked = bookingItems.some((b: any) => {
        const bStart = this.timeToMinutes(b.startTime);
        const bEnd = this.timeToMinutes(b.endTime);
        // overlap condition: slotStart < bEnd AND slotEnd > bStart
        return m < bEnd && (m + SLOT_DURATION_MINUTES) > bStart;
      });

      // Find price slot
      const priceSlot = court.center.priceSlots.find((ps: any) => {
        const psStart = this.timeToMinutes(ps.startTime);
        const psEnd = this.timeToMinutes(ps.endTime);
        // Price slot covers this 30-minute chunk
        return psStart <= m && psEnd >= (m + SLOT_DURATION_MINUTES);
      });

      // Specific price slot wins; basePrice is the fallback for uncovered windows.
      // pricePerHour is the full-hour rate; each 30-min slot is worth half of that.
      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        available: !isBooked && !isPast,
        pricePerHour: priceSlot
          ? Number(priceSlot.pricePerHour)
          : Number(court.center.basePrice),
      });
    }

    return {
      date: dateStr,
      courtId,
      centerId,
      slots,
    };
  }

  async previewBooking(centerId: string, dto: PreviewBookingDto) {
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
    const itemPreviews: any[] = [];
    let totalCourtPrice = 0;

    for (const item of dto.items) {
      const court = courtMap.get(item.courtId);
      if (!court) {
        throw new NotFoundException('One or more courts are not available or not found');
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

        // Each chunk is SLOT_DURATION_MINUTES / 60 of an hour
        courtPrice += ratePerHour * (SLOT_DURATION_MINUTES / 60);
      }

      totalCourtPrice += courtPrice;

      itemPreviews.push({
        courtId: item.courtId,
        courtName: court.name,
        startTime: item.startTime,
        endTime: item.endTime,
        durationHours: (endMins - startMins) / 60,
        breakdown,
        courtPrice,
      });
    }

    const serviceSelections = this.normalizeSelections(dto.serviceItems, undefined, 'serviceId');
    const productSelections = this.normalizeSelections(dto.productItems, undefined, 'productId');

    const { items: services, totalServicePrice } = await this.getBookingServices(centerId, serviceSelections);
    const { items: products, totalProductPrice } = await this.getBookingProducts(centerId, productSelections);

    const totalPrice = totalCourtPrice + totalServicePrice + totalProductPrice;

    return {
      centerId,
      date: dto.date,
      bookingCount: itemPreviews.length,
      items: itemPreviews,
      totalCourtPrice,
      services,
      servicePrice: totalServicePrice,
      products,
      productPrice: totalProductPrice,
      totalPrice,
    };
  }

  async createBookingInternal(
    tx: Prisma.TransactionClient,
    playerId: string,
    centerId: string,
    bookingDateStr: string,
    items: Array<{ courtId: string; startTime: string; endTime: string }>,
    playerName: string,
    phoneNumber: string,
    useCredit?: boolean,
    serviceItems?: any[],
    serviceIds?: string[],
    productItems?: any[],
    productIds?: string[],
    note?: string,
  ) {
    const date = new Date(bookingDateStr);
    const uniqueCourtIds = Array.from(new Set(items.map(item => item.courtId)));

    const txDatabase: any = tx;

    const courts: any[] = await txDatabase.court.findMany({
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
      startMins: number;
      endMins: number;
      durationHours: number;
      breakdown: { startTime: string; endTime: string; pricePerHour: number }[];
      courtPrice: number;
    }> = [];

    for (const item of items) {
      const court = courtMap.get(item.courtId);
      if (!court) {
        throw new NotFoundException('One or more courts are not available or not found');
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

      const bookingStartDateTime = new Date(`${bookingDateStr}T${item.startTime}:00+07:00`);
      if (bookingStartDateTime < new Date()) {
        throw new BadRequestException('Cannot book a court for a past date or time');
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

      const overlaps = await txDatabase.bookingItem.findFirst({
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
        startMins,
        endMins,
        durationHours: (endMins - startMins) / 60,
        breakdown,
        courtPrice,
      });
    }

    const serviceSelections = this.normalizeSelections(serviceItems, serviceIds, 'serviceId');
    const productSelections = this.normalizeSelections(productItems, productIds, 'productId');

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
        playerId,
        playerName,
        phoneNumber,
        date,
        status: 'PENDING',
        totalPrice: bookingTotalPrice,
        note,
        creditApplied: 0,
        paymentRemaining: bookingTotalPrice,
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
        bookingItems: {
          include: {
            court: {
              include: {
                center: {
                  select: {
                    paymentAccountName: true,
                    paymentAccountNumber: true,
                    paymentBankName: true,
                    paymentQrUrl: true,
                  },
                },
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
        center: {
          select: {
            id: true,
            name: true,
            paymentAccountName: true,
            paymentAccountNumber: true,
            paymentBankName: true,
            paymentQrUrl: true,
          },
        },
      } as any,
    } as any);

    let creditApplied = 0;
    let paymentRemaining = bookingTotalPrice;
    let finalStatus: string = 'PENDING';

    if (useCredit) {
      const credit = await this.creditService.applyCreditToBooking(
        tx,
        playerId,
        centerId,
        booking.id,
        bookingTotalPrice,
      );
      creditApplied = credit.applied;
      paymentRemaining = credit.remaining;
      finalStatus = credit.remaining === 0 ? 'CONFIRMED' : 'PENDING';

      await txDatabase.booking.update({
        where: { id: booking.id },
        data: {
          creditApplied,
          paymentRemaining,
          status: finalStatus,
        } as any,
      });
    }

    const enrichedItems = preparedItems.map(item => ({
      courtId: item.court.id,
      courtName: item.court.name,
      startTime: item.startTime,
      endTime: item.endTime,
      durationHours: item.durationHours,
      breakdown: item.breakdown,
      courtPrice: item.courtPrice,
    }));

    const expiresAt = finalStatus === 'PENDING'
      ? new Date(booking.createdAt.getTime() + BOOKING_TIMEOUT_MINUTES * 60_000)
      : null;

    return {
      ...booking,
      status: finalStatus,
      creditApplied,
      paymentRemaining,
      expiresAt,
      bookingTimeoutMinutes: finalStatus === 'PENDING' ? BOOKING_TIMEOUT_MINUTES : null,
      bookingCount: preparedItems.length,
      items: enrichedItems,
      totalCourtPrice,
      totalServicePrice: totalServicePriceAll,
      totalProductPrice: totalProductPriceAll,
      totalPrice: bookingTotalPrice,
      services,
      servicePricePerItem: totalServicePrice,
      products,
      productPricePerItem: totalProductPrice,
    };
  }
  async createBooking(playerId: string, centerId: string, dto: CreateBookingDto) {
    return this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const dayBooking of dto.bookings) {
        const created = await this.createBookingInternal(
          tx,
          playerId,
          centerId,
          dayBooking.date,
          dayBooking.items,
          dto.playerName,
          dto.phoneNumber,
          dto.useCredit,
          dayBooking.serviceItems,
          dayBooking.serviceIds,
          dayBooking.productItems,
          dayBooking.productIds,
          dayBooking.note,
        );
        results.push(created);
      }
      return results;
    });
  }
  async getMyBookings(playerId: string, query: ListBookingsQueryDto) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const where: any = { playerId };

    if (query.status) where.status = query.status;
    if (query.courtId) where.bookingItems = { some: { courtId: query.courtId } };
    if (query.centerId) where.centerId = query.centerId;
    
    if (query.date) {
      where.date = new Date(query.date);
    } else {
      const dateConditions: any = {};
      if (query.startDate) dateConditions.gte = new Date(query.startDate);
      if (query.endDate) dateConditions.lte = new Date(query.endDate);

      if (query.timeFilter) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // start of today
        
        if (query.timeFilter === 'PAST') {
          if (!dateConditions.lt || dateConditions.lt > today) {
            dateConditions.lt = today;
            delete dateConditions.lte; // avoid conflicting lte/lt if lt is stricter
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
          center: true,
          bookingItems: {
            include: {
              court: true,
            },
          },
          bookingServices: {
            include: { service: true },
          },
          bookingProducts: {
            include: { product: true },
          },
        }
      }),
      this.prisma.booking.count({ where })
    ]);

    return { data, pagination: { limit, offset, total } };
  }

  async getBookingDetail(playerId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, playerId },
      include: {
        center: true,
        bookingItems: {
          include: {
            court: true,
          },
        },
        bookingServices: {
          include: { service: true },
        },
        bookingProducts: {
          include: { product: true },
        },
      }
    });

    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async getBookingsByIds(bookingIds: string[]) {
    if (bookingIds.length === 0) return { bookingInfos: [] };

    const uniqueIds = Array.from(new Set(bookingIds));
    const bookings = await this.prisma.booking.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        playerId: true,
        date: true,
        status: true,
        totalPrice: true,
        center: {
          select: { id: true, name: true, address: true },
        },
        bookingItems: {
          select: {
            id: true,
            courtId: true,
            startTime: true,
            endTime: true,
            court: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    const bookingMap = new Map(bookings.map(booking => [booking.id, booking]));
    const bookingInfos = bookingIds
      .map(id => bookingMap.get(id))
      .filter((booking): booking is NonNullable<typeof booking> => Boolean(booking));

    return { bookingInfos };
  }

  // functions to link bookings to play sessions
  async linkPlaySession(dto: LinkPlaySessionDto) {
    // Deduplicate bookingIds
    const uniqueIds = Array.from(new Set(dto.bookingIds));

    // Fetch booking infos
    const bookings: any[] = await this.prisma.booking.findMany({
      where: { id: { in: uniqueIds } } as any,
      select: { id: true, playSessionId: true, status: true } as any,
    } as any);

    // Validate all bookings exist
    if (bookings.length !== uniqueIds.length) {
      throw new NotFoundException('One or more bookings not found');
    }

    // Validate booking status
    const invalidStatus = bookings.filter(
      (booking) => booking.status !== "CONFIRMED"
    );
    if (invalidStatus.length > 0) {
      throw new BadRequestException(`One or more bookings are not confirmed`);
    }

    // Validate bookings are not already linked to a different play session
    const alreadyLinked = bookings.filter(
      (booking) =>
        booking.playSessionId &&
        booking.playSessionId !== dto.playSessionId,
    );

    if (alreadyLinked.length > 0) {
      throw new BadRequestException('One or more bookings are already linked');
    }

    // Atomic update to link all bookings to the play session
    const result = await this.prisma.$transaction(async (tx) => {
      const txDatabase: any = tx;
      const updateResult = await txDatabase.booking.updateMany({
        where: {
          id: { in: uniqueIds },

          // Only allow confirmed bookings
          status: 'CONFIRMED',

          // Prevent race-condition
          OR: [
            { playSessionId: null },
            { playSessionId: dto.playSessionId },
          ],
        } as any,
        data: { playSessionId: dto.playSessionId } as any,
      } as any);

      // Prevent partial success
      if (updateResult.count !== uniqueIds.length) {
        throw new BadRequestException('Failed to link some bookings');
      }

      return updateResult;
    });

    return {
      message: 'Bookings linked successfully',
      data: { updatedCount: result.count },
    };
  }

  // functions to unlink bookings from play sessions
  async unlinkPlaySession(dto: UnlinkPlaySessionDto) {
    // Deduplicate bookingIds
    const uniqueIds = Array.from(new Set(dto.bookingIds));

    // Validate all bookings exist
    const bookings: any[] = await this.prisma.booking.findMany({
      where: { id: { in: uniqueIds } } as any,

      select: { id: true, playSessionId: true } as any,
    } as any);

    if (bookings.length !== uniqueIds.length) {
      throw new NotFoundException('One or more bookings not found');
    }

    // Validate all bookings belong to this play session
    const invalidBookings = bookings.filter(
      (booking) =>
        booking.playSessionId !== dto.playSessionId
    );

    if (invalidBookings.length > 0) {
      throw new BadRequestException('One or more bookings are not linked to this play session');
    }

    // Atomic update to unlink all bookings from their play sessions
    const result = await this.prisma.$transaction(async (tx) => {
      const txDatabase: any = tx;
      const updateResult = await txDatabase.booking.updateMany({
        where: {
          id: { in: uniqueIds },

          // Prevent race-condition
          playSessionId: dto.playSessionId,
        } as any,
        data: { playSessionId: null } as any,
      } as any);

      if (updateResult.count !== uniqueIds.length) {
        throw new BadRequestException('Failed to unlink some bookings');
      }

      return updateResult;
    });

    return {
      message: 'Bookings unlinked successfully',
      data: { updatedCount: result.count },
    };
  }

  /**
   * Player submits a payment proof image URL for a PENDING booking.
   * The owner then reviews the proof and decides to CONFIRM or CANCEL.
   */
  async submitPaymentProof(playerId: string, bookingId: string, paymentProofUrl: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, playerId } as any,
      });

      if (!booking) throw new NotFoundException('Booking not found');

      if ((booking as any).status !== 'PENDING') {
        throw new BadRequestException(
          `Payment proof can only be submitted for PENDING bookings. Current status: ${(booking as any).status}`,
        );
      }

      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          paymentProofUrl,
          paymentProofUploadedAt: new Date(),
        } as any,
      });

      await this.paymentTransactions.recordPendingBankTransfer(
        tx,
        {
          id: updatedBooking.id,
          centerId: updatedBooking.centerId,
          playerId: updatedBooking.playerId,
          paymentRemaining: updatedBooking.paymentRemaining,
          paymentProofUrl,
        },
        paymentProofUrl,
      );

      return updatedBooking;
    });
  }

  async cancelBooking(
    playerId: string,
    bookingId: string,
    reason: BookingCancelReason = 'PLAYER_CANCEL',
  ) {
    // Fetch booking with center cancellation policy
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, playerId } as any,
      include: {
        bookingProducts: {
          select: { productId: true, quantity: true },
        },
        bookingItems: {
          select: { startTime: true, endTime: true },
        },
        center: {
          select: {
            id: true,
            allowCancellation: true,
            cancellationTiers: true,
          },
        },
      } as any,
    } as any);

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      throw new BadRequestException(`Cannot cancel booking with status ${booking.status}`);
    }

    const center = (booking as any).center;
    const bookingStartTime = (booking as any).bookingItems
      ?.map((item: any) => item.startTime)
      ?.sort()?.[0];

    // CONFIRMED booking — apply the center's cancellation policy
    if (booking.status === 'CONFIRMED') {
      if (!center.allowCancellation) {
        throw new BadRequestException(
          'This sport center does not allow player-initiated cancellations of confirmed bookings',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const txDatabase: any = tx;

      // Restore product stock regardless of status
      for (const item of (booking as any).bookingProducts) {
        await txDatabase.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      await txDatabase.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });

      if (booking.status === 'CONFIRMED') {
        // Resolve refund percentage from tiered policy
        const refundPercent = this.creditService.resolveRefundPercent(
          center.cancellationTiers,
          booking.date,
          bookingStartTime ?? '00:00',
        );

        if (refundPercent > 0 && booking.totalPrice) {
          const refundAmount = parseFloat(
            (Number(booking.totalPrice) * refundPercent / 100).toFixed(2),
          );
          await this.creditService.refundCredit(
            tx,
            playerId,
            center.id,
            bookingId,
            refundAmount,
            `${refundPercent}% preservation credit refund for player-initiated cancellation`,
          );
        }
      } else if (booking.status === 'PENDING') {
        await this.paymentTransactions.voidPendingPayment(tx, bookingId, 'PLAYER_CANCEL');

        if (Number((booking as any).creditApplied) > 0) {
          // PENDING cancellation — refund only the credit that was already deducted
          await this.creditService.refundCredit(
            tx,
            playerId,
            center.id,
            bookingId,
            Number((booking as any).creditApplied),
            'Preservation credit refunded for pending booking cancellation',
          );
        }
      }
    });
  }

  /**
   * Returns 30-minute availability slots for ALL active courts in a center for a given date.
   * Eliminates N+1 round-trips the frontend would need when showing the multi-court view.
   */
  async getBulkAvailability(centerId: string, dateStr: string) {
    const center = await this.prisma.sportCenter.findFirst({
      where: { id: centerId, status: 'ACTIVE', deletedAt: null },
      include: {
        priceSlots: true,
        courts: {
          where: { status: 'ACTIVE' },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!center) throw new NotFoundException('Sport center not found or not active');

    const date = new Date(dateStr);
    const openMins = this.timeToMinutes(center.openTime);
    const closeMins = this.timeToMinutes(center.closeTime);

    // Single query for all bookings across all courts on that date
    const courtIds = center.courts.map(c => c.id);
    const allBookingItems = await (this.prisma as any).bookingItem.findMany({
      where: {
        courtId: { in: courtIds },
        booking: {
          date,
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
      },
      select: { courtId: true, startTime: true, endTime: true },
    });

    // Group by courtId for O(1) lookup per slot
    const bookingsByCourtId = new Map<string, { startTime: string; endTime: string }[]>();
    for (const b of allBookingItems) {
      if (!bookingsByCourtId.has(b.courtId)) bookingsByCourtId.set(b.courtId, []);
      bookingsByCourtId.get(b.courtId)!.push({ startTime: b.startTime, endTime: b.endTime });
    }

    const now = new Date();

    const courts = center.courts.map(court => {
      const courtBookings = bookingsByCourtId.get(court.id) ?? [];
      const slots: { startTime: string; endTime: string; available: boolean; pricePerHour: number }[] = [];

      for (let m = openMins; m < closeMins; m += SLOT_DURATION_MINUTES) {
        const slotEnd = m + SLOT_DURATION_MINUTES;
        const slotStartStr = this.minutesToTime(m);

        const slotStartDateTime = new Date(`${dateStr}T${slotStartStr}:00+07:00`);
        const isPast = slotStartDateTime < now;

        const isBooked = courtBookings.some(
          b => m < this.timeToMinutes(b.endTime) && slotEnd > this.timeToMinutes(b.startTime),
        );

        const priceSlot = center.priceSlots.find(ps => {
          const psStart = this.timeToMinutes(ps.startTime);
          const psEnd = this.timeToMinutes(ps.endTime);
          return psStart <= m && psEnd >= slotEnd;
        });

        slots.push({
          startTime: slotStartStr,
          endTime: this.minutesToTime(slotEnd),
          available: !isBooked && !isPast,
          pricePerHour: priceSlot ? Number(priceSlot.pricePerHour) : Number(center.basePrice),
        });
      }

      return { courtId: court.id, courtName: court.name, slots };
    });

    return {
      date: dateStr,
      centerId,
      courtCount: center.courts.length,
      courts,
    };
  }

  async queryPlayerBookings(playerId: string, startDate?: string, endDate?: string) {
    const where: any = {
      playerId,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    return this.prisma.booking.findMany({
      where,
      orderBy: { date: 'asc' },
      include: {
        center: true,
        bookingItems: {
          include: {
            court: true,
          },
        },
      },
    });
  }

  async checkCancelEligibilityInternal(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId } as any,
      include: {
        bookingItems: {
          select: { startTime: true, endTime: true },
        },
        center: {
          select: {
            id: true,
            allowCancellation: true,
            cancellationTiers: true,
          },
        },
      } as any,
    } as any);

    if (!booking) throw new NotFoundException('Booking not found');

    const center = (booking as any).center;
    const bookingStartTime = (booking as any).bookingItems
      ?.map((item: any) => item.startTime)
      ?.sort()?.[0];

    let refundPercent = 0;
    let eligibleForRefund = false;

    if (booking.status === 'CONFIRMED') {
      if (center.allowCancellation) {
        refundPercent = this.creditService.resolveRefundPercent(
          center.cancellationTiers,
          booking.date,
          bookingStartTime ?? '00:00',
        );
        eligibleForRefund = refundPercent > 0;
      }
    } else if (booking.status === 'PENDING') {
      eligibleForRefund = true;
      refundPercent = 100;
    }

    const warningMessage = eligibleForRefund
      ? 'Số tiền đặt sân sẽ được bảo lưu cho lần sau dưới dạng số dư tín dụng. Bạn có chắc chắn muốn hủy đặt sân này không?'
      : 'Buổi đặt sân này đã quá hạn hủy tự do. Nếu hủy, bạn sẽ KHÔNG được bảo lưu số tiền đặt sân từ phía chủ sân. Bạn có chắc chắn xác nhận hủy không?';

    return {
      bookingId,
      centerId: center.id,
      totalCost: Number(booking.totalPrice ?? 0),
      eligibleForRefund,
      refundPercent,
      warningMessage,
    };
  }

  async cancelBookingInternal(bookingId: string, reason: BookingCancelReason = 'PLAYER_CANCEL') {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId } as any,
    } as any);
    if (!booking) throw new NotFoundException('Booking not found');

    return this.cancelBooking(booking.playerId, bookingId, reason);
  }
}
