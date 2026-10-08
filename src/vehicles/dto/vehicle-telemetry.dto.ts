// D:\Sec\safe_path_nodejs\src\vehicles\dto\vehicle-telemetry.dto.ts

import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class VehicleTelemetryDto {
  @IsString()
  vehicleId!: string;

  @IsString()
  @IsIn([
    'CAR',
    'VIP',
    'POLICE',
    'FIRE_ENGINE',
    'AMBULANCE',
  ])
  vehicleType!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsNumber()
  @Min(0)
  speed!: number;

  @IsNumber()
  @Min(0)
  @Max(359.999999)
  heading!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @IsDateString()
  lastOnline!: string;

  @IsBoolean()
  currentOnline!: boolean;
}