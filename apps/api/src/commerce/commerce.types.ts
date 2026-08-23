import {
  CommerceCouponDiscountType,
  CommerceCouponStatus,
  CommercePaymentMethod,
  CommerceProductKind,
  CommerceProductStatus,
} from "@prisma/client";
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
