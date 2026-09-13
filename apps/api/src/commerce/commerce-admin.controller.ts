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
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthContext } from "../auth/auth.types";
import { CsrfGuard } from "../auth/csrf.guard";
import { CurrentAuthContext } from "../auth/current-auth-context.decorator";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { PrivilegedMutationAuditInterceptor } from "../auth/privileged-mutation-audit.interceptor";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CommerceService } from "./commerce.service";
import {
  AdminOrderQueryDto,
  CreateCommerceCouponDto,
  CreateCommerceProductDto,
  ManualApproveOrderDto,
  OrderReferenceDto,
  UpdateCommerceProductDto,
} from "./commerce.types";

@Controller("admin/commerce")
@UseGuards(AuthGuard, RolesGuard, PermissionsGuard)
@Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN, MembershipRole.ORGANIZATION_ADMIN)
@UseInterceptors(PrivilegedMutationAuditInterceptor)
export class CommerceAdminController {
  public constructor(
    @Inject(CommerceService)
    private readonly commerce: CommerceService,
  ) {}

  @Get("products")
  @Permissions("commerce.view")
  @Header("cache-control", "no-store")
  public products(@CurrentAuthContext() context: AuthContext) {
    return this.commerce.listProducts(context);
  }

  @Post("products")
  @Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @Permissions("commerce.product.manage", "commerce.price.manage")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createProduct(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: CreateCommerceProductDto,
  ) {
    return this.commerce.createProduct(context, body);
  }

  @Put("products/:productId")
  @Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @Permissions("commerce.product.manage", "commerce.price.manage")
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
  @Permissions("commerce.view")
  @Header("cache-control", "no-store")
  public coupons(@CurrentAuthContext() context: AuthContext) {
    return this.commerce.listCoupons(context);
  }

  @Post("coupons")
  @Permissions("commerce.coupon.manage")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createCoupon(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: CreateCommerceCouponDto,
  ) {
    return this.commerce.createCoupon(context, body);
  }

  @Get("orders")
  @Permissions("commerce.view")
  @Header("cache-control", "no-store")
  public orders(@CurrentAuthContext() context: AuthContext, @Query() query: AdminOrderQueryDto) {
    return this.commerce.listOrders(context, query);
  }

  @Get("orders/:orderId")
  @Permissions("commerce.view")
  @Header("cache-control", "no-store")
  public order(
    @CurrentAuthContext() context: AuthContext,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
  ) {
    return this.commerce.getOrder(context, orderId);
  }

  @Post("orders/:orderId/cancel")
  @Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @Permissions("commerce.payment.approve")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public cancel(
    @CurrentAuthContext() context: AuthContext,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Body() body: OrderReferenceDto,
  ) {
    return this.commerce.cancelOrder(context, orderId, body);
  }

  @Post("orders/:orderId/refund")
  @Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @Permissions("commerce.payment.approve")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public refund(
    @CurrentAuthContext() context: AuthContext,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Body() body: OrderReferenceDto,
  ) {
    return this.commerce.refundOrder(context, orderId, body);
  }

  @Post("orders/:orderId/fulfil")
  @Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @Permissions("commerce.payment.approve")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public fulfil(
    @CurrentAuthContext() context: AuthContext,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
  ) {
    return this.commerce.retryFulfilment(context, orderId);
  }

  @Post("orders/:orderId/manual-approve")
  @Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @Permissions("commerce.payment.approve")
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
