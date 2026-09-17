import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogItem } from '../../database/entities/catalog-item.entity';
import {
  UbigeoDepartment,
  UbigeoDistrict,
  UbigeoProvince,
} from '../../database/entities/ubigeo.entity';
import { CatalogsController } from './catalogs.controller';
import { CatalogsService } from './catalogs.service';
import { CatalogValueService } from './catalog-value.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CatalogItem,
      UbigeoDepartment,
      UbigeoProvince,
      UbigeoDistrict,
    ]),
  ],
  controllers: [CatalogsController],
  providers: [CatalogsService, CatalogValueService],
  exports: [CatalogsService, CatalogValueService],
})
export class CatalogsModule {}
