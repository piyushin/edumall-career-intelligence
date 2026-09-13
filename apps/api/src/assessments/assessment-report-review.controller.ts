import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthContext } from "../auth/auth.types";
import { CsrfGuard } from "../auth/csrf.guard";
import { CurrentAuthContext } from "../auth/current-auth-context.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AssessmentReportReviewService } from "./assessment-report-review.service";
import {
  AssessmentReportReviewListQueryDto,
  CreateAssessmentCounsellorNoteDto,
  WithdrawAssessmentReportReleaseDto,
} from "./assessment-report-review.types";

const REVIEW_ROLES = [
  MembershipRole.SUPER_ADMIN,
  MembershipRole.ORGANIZATION_ADMIN,
  MembershipRole.COUNSELLOR,
];

// Release/withdraw/notes are a counsellor's clinical review actions (D-007, D-010).
// Organization admins may view the review queue but do not act on it.
const RELEASE_ACTION_ROLES = [MembershipRole.SUPER_ADMIN, MembershipRole.COUNSELLOR];

@Controller("report-reviews")
@UseGuards(AuthGuard, RolesGuard)
@Roles(...REVIEW_ROLES)
export class AssessmentReportReviewController {
  public constructor(
    @Inject(AssessmentReportReviewService)
    private readonly reviews: AssessmentReportReviewService,
  ) {}

  @Get()
  @Header("cache-control", "no-store")
  public list(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: AssessmentReportReviewListQueryDto,
  ) {
    return this.reviews.listReleases(context, query.organizationId, query.status);
  }

  @Get(":attemptId")
  @Header("cache-control", "no-store")
  public detail(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
  ) {
    return this.reviews.getReleaseDetail(context, attemptId);
  }

  @Post(":attemptId/release")
  @Header("cache-control", "no-store")
  @Roles(...RELEASE_ACTION_ROLES)
  @UseGuards(CsrfGuard)
  public release(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
  ) {
    return this.reviews.release(context, attemptId);
  }

  @Post(":attemptId/withdraw")
  @Header("cache-control", "no-store")
  @Roles(...RELEASE_ACTION_ROLES)
  @UseGuards(CsrfGuard)
  public withdraw(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
    @Body() body: WithdrawAssessmentReportReleaseDto,
  ) {
    return this.reviews.withdraw(context, attemptId, body.reason);
  }

  @Get(":attemptId/notes")
  @Header("cache-control", "no-store")
  public listNotes(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
  ) {
    return this.reviews.listNotes(context, attemptId);
  }

  @Post(":attemptId/notes")
  @Header("cache-control", "no-store")
  @Roles(...RELEASE_ACTION_ROLES)
  @UseGuards(CsrfGuard)
  public addNote(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
    @Body() body: CreateAssessmentCounsellorNoteDto,
  ) {
    return this.reviews.addNote(context, attemptId, body.body);
  }
}
