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
import { CommercePricingService } from "./commerce-pricing.service";
import { CommerceService } from "./commerce.service";
import {
  AdminOrderQueryDto,
  CreateCommerceCouponDto,
  CreateCommerceProductDto,
  ManualApproveOrderDto,
  OrderReferenceDto,
  RefundOrderDto,
  SetOrganizationPriceDto,
  SubmitManualPaymentDto,
  UpdateCommerceProductDto,
  UpdateOrganizationPolicyDto,
  UpdatePlatformPolicyDto,
} from "./commerce.types";

@Controller("admin/commerce")
@UseGuards(AuthGuard, RolesGuard, PermissionsGuard)
@Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN, MembershipRole.ORGANIZATION_ADMIN)
@UseInterceptors(PrivilegedMutationAuditInterceptor)
export class CommerceAdminController {
  public constructor(
    @Inject(CommerceService)
    private readonly commerce: CommerceService,
    @Inject(CommercePricingService)
    private readonly pricing: CommercePricingService,
  ) {}

  @Get("policy")
  @Permissions("commerce.view")
  @Header("cache-control", "no-store")
  public platformPolicy() {
    return this.pricing.getPlatformPolicy();
  }

  @Put("policy")
  @Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @Permissions("commerce.price.manage")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public updatePlatformPolicy(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: UpdatePlatformPolicyDto,
  ) {
    return this.pricing.updatePlatformPolicy(context, body);
  }

  @Get("organizations/:organizationId/policy")
  @Permissions("commerce.view")
  @Header("cache-control", "no-store")
  public organizationPolicy(
    @CurrentAuthContext() context: AuthContext,
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
  ) {
    return this.pricing.getOrganizationPolicy(context, organizationId);
  }

  @Put("organizations/:organizationId/policy")
  @Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @Permissions("commerce.price.manage")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public updateOrganizationPolicy(
    @CurrentAuthContext() context: AuthContext,
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Body() body: UpdateOrganizationPolicyDto,
  ) {
    return this.pricing.updateOrganizationPolicy(context, organizationId, body);
  }

  @Get("organization-prices")
  @Permissions("commerce.view")
  @Header("cache-control", "no-store")
  public organizationPrices(
    @CurrentAuthContext() context: AuthContext,
    @Query("organizationId") organizationId?: string,
  ) {
    return this.pricing.listOrganizationPrices(context, organizationId);
  }

  // Tenant selling price: available to organization admins only when the
  // platform has delegated pricing to that organization (checked in the service).
  @Put("organization-prices")
  @Permissions("commerce.price.manage")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public setOrganizationPrice(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: SetOrganizationPriceDto,
  ) {
    return this.pricing.setOrganizationPrice(context, body);
  }

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
  @Permissions("commerce.refund.manage")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public refund(
    @CurrentAuthContext() context: AuthContext,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Body() body: RefundOrderDto,
  ) {
    return this.commerce.refundOrder(context, orderId, body);
  }

  // Institutional manual payment: the purchasing organization records its bank
  // transfer / UPI reference here; approval is the separate central route.
  @Post("orders/:orderId/manual-payment")
  @Permissions("commerce.view")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public submitManualPayment(
    @CurrentAuthContext() context: AuthContext,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Body() body: SubmitManualPaymentDto,
  ) {
    return this.commerce.submitManualPayment(context, orderId, body);
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
