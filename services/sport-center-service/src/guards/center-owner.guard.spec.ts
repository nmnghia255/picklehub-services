import { Test } from "@nestjs/testing";
import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { CenterOwnerGuard } from "./center-owner.guard";
import { PrismaService } from "../prisma.service";

describe("CenterOwnerGuard", () => {
  let guard: CenterOwnerGuard;
  let prisma: { sportCenter: { findUnique: jest.Mock } };

  const buildContext = (userId?: string, centerId?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { userId } : undefined,
          params: centerId ? { centerId } : {},
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    prisma = { sportCenter: { findUnique: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CenterOwnerGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    guard = moduleRef.get(CenterOwnerGuard);
  });

  it("allows the owner", async () => {
    prisma.sportCenter.findUnique.mockResolvedValue({ ownerId: "user-1" });
    await expect(
      guard.canActivate(buildContext("user-1", "center-1"))
    ).resolves.toBe(true);
  });

  it("rejects a non-owner with 403", async () => {
    prisma.sportCenter.findUnique.mockResolvedValue({ ownerId: "user-2" });
    await expect(
      guard.canActivate(buildContext("user-1", "center-1"))
    ).rejects.toThrow(ForbiddenException);
  });

  it("returns 404 when the center does not exist", async () => {
    prisma.sportCenter.findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(buildContext("user-1", "center-1"))
    ).rejects.toThrow(NotFoundException);
  });

  it("rejects when JWT did not populate userId", async () => {
    await expect(
      guard.canActivate(buildContext(undefined, "center-1"))
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects when centerId is missing from the route", async () => {
    await expect(guard.canActivate(buildContext("user-1"))).rejects.toThrow(
      ForbiddenException
    );
  });
});
