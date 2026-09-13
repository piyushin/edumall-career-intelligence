import {
  CommerceCouponDiscountType,
  CommerceCouponStatus,
  CommerceOrderFulfilmentStatus,
  CommerceOrderPurchaserType,
  CommerceOrderStatus,
  CommercePaymentMethod,
  CommerceProductAudience,
  CommerceProductKind,
  CommerceProductStatus,
} from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateCandidateOrderDto {
  @IsString()
  @Length(1, 120)
  productCode!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  couponCode?: string;
}

export class VerifyRazorpayPaymentDto {
  @IsUUID()
  orderId!: string;

  @IsString()
  @Length(1, 120)
  razorpayOrderId!: string;

  @IsString()
  @Length(1, 120)
  razorpayPaymentId!: string;

  @IsString()
  @Length(1, 256)
  razorpaySignature!: string;
}

export class CreateCommerceProductDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  assessmentVersionId?: string;

  @IsString()
  @Length(1, 120)
  code!: string;

  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsEnum(CommerceProductKind)
  kind!: CommerceProductKind;

  @IsOptional()
  @IsEnum(CommerceProductAudience)
  audience?: CommerceProductAudience;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  unitQuantity?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsInt()
  @Min(0)
  priceMinor!: number;
}

export class UpdateCommerceProductDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceMinor?: number;

  @IsOptional()
  @IsEnum(CommerceProductAudience)
  audience?: CommerceProductAudience;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  unitQuantity?: number;

  @IsOptional()
  @IsEnum(CommerceProductStatus)
  status?: CommerceProductStatus;
}

export class CreateCommerceCouponDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  productCode?: string;

  @IsString()
  @Length(1, 80)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsEnum(CommerceCouponDiscountType)
  discountType!: CommerceCouponDiscountType;

  @IsOptional()
  @IsEnum(CommerceProductKind)
  appliesToKind?: CommerceProductKind;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  percentageBps?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  fixedAmountMinor?: number;

  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @IsOptional()
  @IsEnum(CommerceCouponStatus)
  status?: CommerceCouponStatus;
}

export class ManualApproveOrderDto {
  @IsEnum(CommercePaymentMethod)
  method!: CommercePaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;
}

export class AdminOrderQueryDto {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsEnum(CommerceOrderStatus) status?: CommerceOrderStatus;
  @IsOptional()
  @IsEnum(CommerceOrderFulfilmentStatus)
  fulfilmentStatus?: CommerceOrderFulfilmentStatus;
  @IsOptional() @IsEnum(CommerceOrderPurchaserType) purchaserType?: CommerceOrderPurchaserType;
  @IsOptional() @IsEnum(CommerceProductKind) productKind?: CommerceProductKind;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}

export class OrderReferenceDto {
  @IsOptional() @IsString() @MaxLength(200) reference?: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
