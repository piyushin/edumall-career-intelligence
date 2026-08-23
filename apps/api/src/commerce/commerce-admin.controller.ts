import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthContext } from "../auth/auth.types";
import { CsrfGuard } from "../auth/csrf.guard";
import { CurrentAuthContext } from "../auth/current-auth-context.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CommerceService } from "./commerce.service";
import {
  CreateCommerceCouponDto,
  CreateCommerceProductDto,
  ManualApproveOrderDto,
  UpdateCommerceProductDto,
} from "./commerce.types";

@Controller("admin/commerce")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.SUPER_ADMIN, MembershipRole.ORGANIZATION_ADMIN)
export class CommerceAdminController {
  public constructor(
    @Inject(CommerceService)
    private readonly commerce: CommerceService,
  ) {}

  @Get("products")
  @Header("cache-control", "no-store")
  public products(@CurrentAuthContext() context: AuthContext) {
    return this.commerce.listProducts(context);
  }

  @Post("products")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createProduct(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: CreateCommerceProductDto,
  ) {
    return this.commerce.createProduct(context, body);
  }

  @Put("products/:productId")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public updateProduct(
    @CurrentAuthContext() context: AuthContext,
    @Param("productId", new ParseUUIDPipe()) productId: string,
    @Body() body: UpdateCommerceProductDto,
  ) {
    return this.commerce.updateProduct(context, productId, body);
  }

  @Get("coupons")
  @Header("cache-control", "no-store")
  public coupons(@CurrentAuthContext() context: AuthContext) {
    return this.commerce.listCoupons(context);
  }

  @Post("coupons")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createCoupon(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: CreateCommerceCouponDto,
  ) {
    return this.commerce.createCoupon(context, body);
  }

  @Get("orders")
  @Header("cache-control", "no-store")
  public orders(@CurrentAuthContext() context: AuthContext) {
    return this.commerce.listOrders(context);
  }

  @Post("orders/:orderId/manual-approve")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public manualApprove(
    @CurrentAuthContext() context: AuthContext,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Body() body: ManualApproveOrderDto,
  ) {
    return this.commerce.manualApproveOrder(context, orderId, body);
  }
}
