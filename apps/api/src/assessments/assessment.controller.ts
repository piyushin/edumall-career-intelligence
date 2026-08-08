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
import { AssessmentService } from "./assessment.service";
import { SaveAssessmentResponseDto } from "./assessment.types";

@Controller("assessments")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.STUDENT, MembershipRole.EMPLOYEE)
export class AssessmentController {
  public constructor(
    @Inject(AssessmentService)
    private readonly assessments: AssessmentService,
  ) {}

  @Get("assignments")
  @Header("cache-control", "no-store")
  public listAssignments(@CurrentAuthContext() context: AuthContext) {
    return this.assessments.listAssignments(context);
  }

  @Post("assignments/:assignmentId/attempts")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public startOrResumeAttempt(
    @CurrentAuthContext() context: AuthContext,
    @Param("assignmentId", new ParseUUIDPipe())
    assignmentId: string,
  ) {
    return this.assessments.startOrResumeAttempt(context, assignmentId);
  }

  @Get("attempts/:attemptId")
  @Header("cache-control", "no-store")
  public getAttempt(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe())
    attemptId: string,
  ) {
    return this.assessments.getAttempt(context, attemptId);
  }

  @Put("attempts/:attemptId/responses/:itemId")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public saveResponse(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe())
    attemptId: string,
    @Param("itemId", new ParseUUIDPipe())
    itemId: string,
    @Body() body: SaveAssessmentResponseDto,
  ) {
    return this.assessments.saveResponse(context, attemptId, itemId, body);
  }

  @Post("attempts/:attemptId/submit")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public submitAttempt(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe())
    attemptId: string,
  ) {
    return this.assessments.submitAttempt(context, attemptId);
  }
}
