import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { EquipmentUsageController } from './usage/equipment-usage.controller';
import { EquipmentUsageService } from './usage/equipment-usage.service';
import { EquipmentFavoriteController } from './favorite/equipment-favorite.controller';
import { EquipmentFavoriteService } from './favorite/equipment-favorite.service';

@Module({
  controllers: [EquipmentController, EquipmentUsageController, EquipmentFavoriteController],
  providers: [
    EquipmentService,
    EquipmentUsageService,
    EquipmentFavoriteService,
    PrismaService,
  ],
})
export class EquipmentModule { }
