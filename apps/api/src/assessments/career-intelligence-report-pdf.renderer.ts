import { ConflictException } from "@nestjs/common";
import { readFileSync } from "node:fs";
import PDFDocument from "pdfkit";
import type { AssessmentReportPayloadV3 } from "./assessment-report-composition.types";

interface ReportSnapshot {
  id: string;
  inputHash: string;
  reportVersion: string;
  generatedAt: Date | string;
  payload: unknown;
}

interface ConstructView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  rawScore: string;
  standardizedScore: string | null;
  percentile: string | null;
  interpretation: string;
  reportSection: string | null;
}

interface CareerPathView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  clusterCode: string;
  clusterName: string;
  clusterDescription: string | null;
  score: string;
  rank: number;
  bandLabel: string | null;
  bandNarrative: string | null;
  evidence: string[];
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 48;
const RIGHT = 48;
const TOP = 48;
const BOTTOM = 58;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const BRAND = "#173A70";
const INK = "#172033";
const MUTED = "#667085";
const LINE = "#E4E7EC";
const PANEL = "#F7F9FC";
const ACCENT = "#F58220";
const REPORT_TITLE = "The EduMall Career Intelligence Report - Next Generation";
const REPORT_EMAIL = "careeradTEM@gmail.com";
const REPORT_WEBSITE = "www.theedumall.com";
const REPORT_PHONE_PRIMARY = "+91 82381 03232";
const REPORT_PHONE_SECONDARY = "+91 85115 50150";
const REPORT_ADDRESS =
  "Office No. 231, The EduMall, Suyash Solitaire, Kudasan, Gandhinagar, Gujarat";
const EDUMALL_LOGO = readFileSync(new URL("./assets/edumall-logo.png", import.meta.url));

const DIMENSION_SECTIONS = [
  ["PERSONALITY", "Career Personality"],
  ["INTERESTS", "Career Interests"],
  ["MOTIVATORS", "Career Motivators"],
  ["LEARNING_PROFILE", "Learning Profile"],
  ["APTITUDE_AND_ABILITIES", "Aptitude, Skills and Abilities"],
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function humanizeKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function narrative(value: unknown): string {
  if (value === null || value === undefined) return "";
  const primitive = asString(value);
  if (primitive !== null) return primitive;

  if (Array.isArray(value)) {
    return value
      .map((entry) => narrative(entry))
      .filter(Boolean)
      .join(" • ");
  }

  const record = asRecord(value);
  if (!record) return "";

  for (const key of ["narrative", "summary", "interpretation", "description", "guidance", "text"]) {
    const preferred = narrative(record[key]);
    if (preferred) return preferred;
  }

  return Object.entries(record)
    .map(([key, entry]) => {
      const rendered = narrative(entry);
      return rendered ? `${humanizeKey(key)}: ${rendered}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function compactLines(value: unknown, limit = 8): string[] {
  const rendered = narrative(value);
  if (!rendered) return [];
  return rendered
    .split(/\n|\s+•\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export class CareerIntelligenceReportPdfRenderer {
  public async render(snapshot: ReportSnapshot): Promise<Buffer> {
    const payload = this.parsePayload(snapshot.payload);

    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({
        size: "A4",
        margins: { top: TOP, right: RIGHT, bottom: BOTTOM, left: LEFT },
        bufferPages: true,
        info: {
          Title: REPORT_TITLE,
          Author: "The EduMall",
          Subject: "Governed Career Intelligence and Psychometric Assessment Report",
          Keywords: "career intelligence, psychometric, assessment, The EduMall, Meetium",
          CreationDate: new Date(snapshot.generatedAt),
        },
      });

      const chunks: Buffer[] = [];
      document.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
      document.on("error", reject);
      document.on("end", () => resolve(Buffer.concat(chunks)));

      const constructs = this.extractConstructs(payload);
      const careerPaths = this.extractCareerPaths(payload);

      this.renderCover(document, payload, snapshot);
      this.renderExecutiveSnapshot(document, payload, constructs, careerPaths);
      this.renderHowToUse(document);
      this.renderMethodology(document, payload);
      this.renderScoreGuide(document);
      this.renderProfileOverview(document, constructs);
      this.renderDimensionPages(document, constructs);
      this.renderIntegratedStrengthMap(document, constructs, careerPaths);
      this.renderCareerClusters(document, careerPaths);
      this.renderCareerPathOverview(document, careerPaths);
      this.renderCareerDeepDives(document, careerPaths.slice(0, 10));
      this.renderDecisionMatrix(document, careerPaths.slice(0, 6));
      this.renderEducationRoadmap(document, payload);
      this.renderDevelopmentPlan(document, payload);
      this.renderCounselorDiscussion(document, payload);
      this.renderProvenance(document, payload, snapshot);
      this.addFooters(document, snapshot);

      document.end();
    });
  }

  private parsePayload(value: unknown): AssessmentReportPayloadV3 {
    const record = asRecord(value);
    const composition = asRecord(record?.reportComposition);

    if (
      !record ||
      record.schemaVersion !== "assessment-report-data-v3" ||
      !asRecord(record.assessment) ||
      !asRecord(record.scoring) ||
      !Array.isArray(record.norms) ||
      !asRecord(record.interpretation) ||
      !composition
    ) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_SNAPSHOT_INVALID",
        message: "The immutable v3 report snapshot is not valid for Career Intelligence rendering.",
      });
    }

    return value as AssessmentReportPayloadV3;
  }

  private extractConstructs(payload: AssessmentReportPayloadV3): ConstructView[] {
    const scoring = asRecord(payload.scoring);
    const scoringConstructs = Array.isArray(scoring?.constructs) ? scoring.constructs : [];
    const norms = payload.norms.map((entry) => asRecord(entry)).filter(Boolean) as Record<
      string,
      unknown
    >[];
    const interpretation = asRecord(payload.interpretation);
    const applications = Array.isArray(interpretation?.applications)
      ? (interpretation.applications.map((entry) => asRecord(entry)).filter(Boolean) as Record<
          string,
          unknown
        >[])
      : [];

    return scoringConstructs
      .map((entry) => asRecord(entry))
      .filter(Boolean)
      .map((construct) => {
        const id = asString(construct?.assessmentConstructId) ?? "";
        const norm =
          norms.find((candidate) => asString(candidate.assessmentConstructId) === id) ?? null;
        const interpretationApplication =
          applications.find((candidate) => asString(candidate.assessmentConstructId) === id) ??
          null;
        const metadata = asRecord(construct?.metadata);

        return {
          id,
          code: asString(construct?.code) ?? "—",
          name: asString(construct?.name) ?? "Assessment Construct",
          description: asString(construct?.description),
          rawScore: asString(construct?.rawScore) ?? "—",
          standardizedScore: asString(norm?.standardizedScore),
          percentile: asString(norm?.percentile),
          interpretation:
            narrative(interpretationApplication?.outputData) ||
            "No published narrative interpretation was supplied for this construct.",
          reportSection: asString(metadata?.reportSection)?.toUpperCase() ?? null,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private extractCareerPaths(payload: AssessmentReportPayloadV3): CareerPathView[] {
    const careerFit = asRecord(payload.careerFit);
    const ranked = Array.isArray(careerFit?.rankedCareerPaths) ? careerFit.rankedCareerPaths : [];

    return ranked
      .map((entry) => asRecord(entry))
      .filter(Boolean)
      .map((entry) => {
        const band = asRecord(entry?.recommendationBand);
        return {
          id: asString(entry?.careerPathId) ?? "",
          code: asString(entry?.careerPathCode) ?? "—",
          name: asString(entry?.careerPathName) ?? "Career Path",
          description: asString(entry?.careerPathDescription),
          clusterCode: asString(entry?.careerClusterCode) ?? "—",
          clusterName: asString(entry?.careerClusterName) ?? "Career Cluster",
          clusterDescription: asString(entry?.careerClusterDescription),
          score: asString(entry?.score) ?? "—",
          rank: asNumber(entry?.rank) ?? 0,
          bandLabel: asString(band?.label),
          bandNarrative: narrative(band?.outputData) || null,
          evidence: compactLines(entry?.evidence, 8),
        };
      })
      .sort((left, right) => left.rank - right.rank);
  }

  private renderCover(
    document: PDFKit.PDFDocument,
    payload: AssessmentReportPayloadV3,
    snapshot: ReportSnapshot,
  ): void {
    const assessment = asRecord(payload.assessment);
    const candidate = asRecord(payload.candidate);

    document.rect(0, 0, PAGE_WIDTH, 235).fill(BRAND);
    document.roundedRect(LEFT, 26, 190, 78, 8).fill("#FFFFFF");
    document.image(EDUMALL_LOGO, LEFT + 10, -8, { width: 170 });

    document
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .fontSize(27)
      .text("Career Intelligence Report", LEFT, 118, {
        width: CONTENT_WIDTH,
        lineGap: 4,
      });
    document.font("Helvetica").fontSize(17).fillColor("#DCE8F8").text("Next Generation", LEFT, 160);
    document
      .font("Helvetica-Bold")
      .fontSize(7.8)
      .fillColor("#FFFFFF")
      .text("AN INITIATIVE OF MEETIUM PVT. LTD.", LEFT, 202, {
        characterSpacing: 0.8,
      });

    document.y = 278;
    const rawAssessmentTitle = asString(assessment?.title) ?? "Career Intelligence Assessment";
    const assessmentTitle = rawAssessmentTitle.replace(/DMentor/gi, "The EduMall");
    document
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(23)
      .text(assessmentTitle, LEFT, document.y, { width: CONTENT_WIDTH });
    document
      .moveDown(0.5)
      .font("Helvetica")
      .fontSize(10)
      .fillColor(MUTED)
      .text(
        "A governed assessment report combining published psychometric results with deterministic CareerFit evidence.",
        LEFT,
        document.y,
        { width: CONTENT_WIDTH, lineGap: 3 },
      );

    document.moveDown(1.5);
    const candidateName = [asString(candidate?.firstName), asString(candidate?.lastName)]
      .filter(Boolean)
      .join(" ");
    this.keyValue(document, "Candidate", candidateName || "Candidate");
    this.keyValue(document, "Email", asString(candidate?.email) ?? "—");
    this.keyValue(document, "Edition", asString(assessment?.edition) ?? "—");
    this.keyValue(document, "Language", asString(assessment?.language) ?? "—");
    this.keyValue(document, "Report generated", this.formatDate(snapshot.generatedAt));

    document.moveDown(1.1);
    this.noteBox(
      document,
      "REPORT PRINCIPLE",
      "The conclusions in this report are reproduced from frozen assessment, norm, interpretation and CareerFit records. The PDF renderer does not invent scores, norms, diagnoses or career-fit conclusions.",
    );

    document.moveDown(0.25);
    this.contactBlock(document);
  }

  private renderExecutiveSnapshot(
    document: PDFKit.PDFDocument,
    payload: AssessmentReportPayloadV3,
    constructs: ConstructView[],
    careerPaths: CareerPathView[],
  ): void {
    this.newPage(
      document,
      "Career Intelligence Snapshot",
      "Your high-level assessment and CareerFit dashboard",
    );

    const topPercentiles = constructs
      .filter((construct) => construct.percentile !== null)
      .sort((left, right) => (Number(right.percentile) || 0) - (Number(left.percentile) || 0))
      .slice(0, 4);

    document
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(INK)
      .text("Highest observed construct percentiles");
    document.moveDown(0.7);
    if (topPercentiles.length === 0) {
      this.mutedText(document, "No percentile values were frozen into this snapshot.");
    } else {
      for (const construct of topPercentiles) {
        this.percentileBar(document, construct.name, Number(construct.percentile));
      }
    }

    document.moveDown(1.2);
    document.font("Helvetica-Bold").fontSize(13).fillColor(INK).text("Top CareerFit paths");
    document.moveDown(0.6);

    if (careerPaths.length === 0) {
      this.noteBox(
        document,
        "CAREERFIT PENDING",
        "No governed CareerFit run was frozen into this snapshot. Career recommendations are intentionally omitted.",
      );
    } else {
      careerPaths.slice(0, 5).forEach((path) => this.careerRankCard(document, path));
    }

    const composition = asRecord(payload.reportComposition);
    document.moveDown(0.8);
    this.keyValue(document, "Report template", asString(composition?.templateId) ?? "—");
    this.keyValue(document, "Audience", asString(composition?.audience) ?? "—");
    this.keyValue(document, "Locale", asString(composition?.locale) ?? "—");
  }

  private renderHowToUse(document: PDFKit.PDFDocument): void {
    this.newPage(
      document,
      "How to Use This Report",
      "Use evidence as a guide for exploration, not as a fixed label",
    );
    this.numberedPoint(
      document,
      1,
      "Start with patterns",
      "Look for repeated themes across scores, published interpretations and CareerFit evidence.",
    );
    this.numberedPoint(
      document,
      2,
      "Compare, do not over-read",
      "A percentile describes relative standing in the selected norm group; it does not define personal worth or future success.",
    );
    this.numberedPoint(
      document,
      3,
      "Use CareerFit as prioritisation",
      "Higher ranked paths deserve deeper exploration, but education choices should also consider aspirations, constraints and real-world exposure.",
    );
    this.numberedPoint(
      document,
      4,
      "Discuss uncertainties",
      "Use the counselor discussion pages to capture questions, contradictions and decisions that need human review.",
    );
    this.numberedPoint(
      document,
      5,
      "Turn insight into action",
      "Choose a small number of experiments, courses, projects, conversations or exposure activities for the next 90 days.",
    );

    document.moveDown(1.2);
    this.noteBox(
      document,
      "IMPORTANT",
      "This report supports career planning. It is not a clinical diagnosis and does not replace qualified professional judgment where such judgment is required.",
    );
  }

  private renderMethodology(
    document: PDFKit.PDFDocument,
    payload: AssessmentReportPayloadV3,
  ): void {
    this.newPage(
      document,
      "Assessment Methodology",
      "How this report preserves scientific and operational governance",
    );
    this.bullet(
      document,
      "Responses are scored by the published scoring configuration attached to the immutable assessment version.",
    );
    this.bullet(
      document,
      "Raw construct scores are transformed only through the selected published norm group.",
    );
    this.bullet(
      document,
      "Narrative construct interpretations come only from the selected published interpretation set.",
    );
    this.bullet(
      document,
      "CareerFit rankings come only from a recorded deterministic algorithm run against the frozen scoring run.",
    );
    this.bullet(
      document,
      "The renderer consumes the immutable report snapshot; it does not recompute psychometric or CareerFit results.",
    );

    const provenance = asRecord(payload.provenance);
    if (provenance) {
      document.moveDown(1);
      document.font("Helvetica-Bold").fontSize(12).fillColor(INK).text("Frozen provenance note");
      this.paragraph(
        document,
        narrative(provenance) || "Provenance is stored with this report snapshot.",
      );
    }
  }

  private renderScoreGuide(document: PDFKit.PDFDocument): void {
    this.newPage(
      document,
      "Understanding Your Scores",
      "A practical reading guide for raw, standardized and percentile results",
    );
    this.definitionCard(
      document,
      "Raw score",
      "The direct score produced by the assessment scoring key before normative comparison.",
    );
    this.definitionCard(
      document,
      "Standardized score",
      "A transformed score defined by the selected norm package. The meaning depends on that norm package's published methodology.",
    );
    this.definitionCard(
      document,
      "Percentile",
      "The percentage of the selected reference group at or below the candidate's observed score, when a percentile is supplied by the norm package.",
    );
    this.definitionCard(
      document,
      "Published interpretation",
      "The approved narrative or band attached to the normalized result by the selected interpretation set.",
    );
    this.definitionCard(
      document,
      "CareerFit score",
      "A deterministic model output used to rank mapped career paths. Its interpretation is limited to the published model methodology and recommendation bands.",
    );
  }

  private renderProfileOverview(document: PDFKit.PDFDocument, constructs: ConstructView[]): void {
    if (constructs.length === 0) {
      this.newPage(
        document,
        "Your Psychometric Profile",
        "A consolidated view of the constructs measured in this assessment",
      );
      this.mutedText(document, "No scored constructs were present in this snapshot.");
      return;
    }

    const constructsPerPage = 8;

    for (let offset = 0; offset < constructs.length; offset += constructsPerPage) {
      this.newPage(
        document,
        "Your Psychometric Profile",
        offset === 0
          ? "A consolidated view of the constructs measured in this assessment"
          : "A consolidated view of the constructs measured in this assessment - continued",
      );

      const pageConstructs = constructs.slice(offset, offset + constructsPerPage);
      for (const construct of pageConstructs) {
        const percentile = construct.percentile ? `P${construct.percentile}` : "No percentile";
        const rowY = document.y;

        document.roundedRect(LEFT, rowY, CONTENT_WIDTH, 42, 6).fill(PANEL);
        document
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(INK)
          .text(construct.name, LEFT + 12, rowY + 10, {
            width: CONTENT_WIDTH - 155,
          });
        document
          .font("Helvetica")
          .fontSize(8.5)
          .fillColor(MUTED)
          .text(construct.code, LEFT + 12, rowY + 27, {
            width: CONTENT_WIDTH - 155,
          });
        document
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(BRAND)
          .text(percentile, PAGE_WIDTH - RIGHT - 120, rowY + 18, {
            width: 105,
            align: "right",
          });

        document.y = rowY + 52;
        document.x = LEFT;
      }
    }
  }

  private renderDimensionPages(document: PDFKit.PDFDocument, constructs: ConstructView[]): void {
    const unmapped = constructs.filter(
      (construct) => !DIMENSION_SECTIONS.some(([section]) => construct.reportSection === section),
    );

    for (const [section, title] of DIMENSION_SECTIONS) {
      const group = constructs.filter((construct) => construct.reportSection === section);
      if (group.length === 0) continue;
      this.renderConstructGroup(document, title, section, group);
    }

    if (unmapped.length > 0) {
      this.renderConstructGroup(
        document,
        "Additional Assessment Results",
        "Constructs not assigned to a report section in the published assessment metadata",
        unmapped,
      );
    }
  }

  private renderConstructGroup(
    document: PDFKit.PDFDocument,
    title: string,
    subtitle: string,
    constructs: ConstructView[],
  ): void {
    for (let offset = 0; offset < constructs.length; offset += 3) {
      const pageConstructs = constructs.slice(offset, offset + 3);
      this.newPage(document, title, offset === 0 ? subtitle : `${subtitle} — continued`);
      for (const construct of pageConstructs) {
        this.constructCard(document, construct);
      }
    }
  }

  private renderIntegratedStrengthMap(
    document: PDFKit.PDFDocument,
    constructs: ConstructView[],
    careerPaths: CareerPathView[],
  ): void {
    this.newPage(
      document,
      "Integrated Strength Map",
      "A cross-view of measured strengths and career-fit direction",
    );
    const rankedConstructs = constructs
      .filter((construct) => construct.percentile !== null)
      .sort((left, right) => (Number(right.percentile) || 0) - (Number(left.percentile) || 0))
      .slice(0, 6);

    document.font("Helvetica-Bold").fontSize(12).fillColor(INK).text("Measured strengths");
    document.moveDown(0.5);
    rankedConstructs.forEach((construct) =>
      this.percentileBar(document, construct.name, Number(construct.percentile)),
    );

    document.moveDown(1.1);
    document.font("Helvetica-Bold").fontSize(12).fillColor(INK).text("CareerFit direction");
    document.moveDown(0.5);
    careerPaths.slice(0, 5).forEach((path) => this.careerRankCard(document, path));

    document.moveDown(0.8);
    this.mutedText(
      document,
      "This page juxtaposes frozen outputs for discussion. It does not calculate a new composite psychological conclusion.",
    );
  }

  private renderCareerClusters(document: PDFKit.PDFDocument, careerPaths: CareerPathView[]): void {
    this.newPage(document, "Career Cluster Map", "Where the highest ranked paths are concentrated");
    const clusters = new Map<string, CareerPathView[]>();
    for (const path of careerPaths) {
      const key = `${path.clusterCode}|${path.clusterName}`;
      const list = clusters.get(key) ?? [];
      list.push(path);
      clusters.set(key, list);
    }

    if (clusters.size === 0) {
      this.mutedText(document, "No CareerFit cluster data is available in this snapshot.");
      return;
    }

    [...clusters.entries()]
      .sort((left, right) => (left[1][0]?.rank ?? 999) - (right[1][0]?.rank ?? 999))
      .slice(0, 8)
      .forEach(([key, paths]) => {
        const [, name] = key.split("|");
        const top = paths[0];
        document.roundedRect(LEFT, document.y, CONTENT_WIDTH, 62, 6).fillAndStroke(PANEL, LINE);
        const y = document.y + 11;
        document
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor(INK)
          .text(name ?? "Career Cluster", LEFT + 12, y, {
            width: CONTENT_WIDTH - 120,
          });
        document
          .font("Helvetica")
          .fontSize(8.5)
          .fillColor(MUTED)
          .text(
            `${paths.length} ranked path${paths.length === 1 ? "" : "s"} in snapshot`,
            LEFT + 12,
            y + 20,
          );
        document
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(BRAND)
          .text(top ? `Best rank #${top.rank}` : "—", PAGE_WIDTH - RIGHT - 110, y + 12, {
            width: 95,
            align: "right",
          });
        document.y += 72;
      });
  }

  private renderCareerPathOverview(
    document: PDFKit.PDFDocument,
    careerPaths: CareerPathView[],
  ): void {
    for (let offset = 0; offset < Math.min(careerPaths.length, 12); offset += 6) {
      this.newPage(
        document,
        "Career Path Recommendations",
        offset === 0
          ? "Deterministic ranked CareerFit outputs"
          : "Deterministic ranked CareerFit outputs — continued",
      );
      careerPaths
        .slice(offset, offset + 6)
        .forEach((path) => this.careerRankCard(document, path, true));
    }

    if (careerPaths.length === 0) {
      this.newPage(
        document,
        "Career Path Recommendations",
        "Deterministic ranked CareerFit outputs",
      );
      this.noteBox(
        document,
        "NOT AVAILABLE",
        "Career recommendations are omitted because this snapshot does not contain a governed CareerFit run.",
      );
    }
  }

  private renderCareerDeepDives(document: PDFKit.PDFDocument, careerPaths: CareerPathView[]): void {
    for (const path of careerPaths) {
      this.newPage(
        document,
        `Career Deep Dive #${path.rank}`,
        `${path.clusterName} • ${path.code}`,
      );
      document.font("Helvetica-Bold").fontSize(24).fillColor(INK).text(path.name);
      document.moveDown(0.5);
      this.keyValue(document, "CareerFit score", path.score);
      this.keyValue(document, "Recommendation band", path.bandLabel ?? "No published band");
      this.keyValue(document, "Cluster", path.clusterName);

      if (path.description) {
        document.moveDown(0.5);
        document
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor(INK)
          .text("Published career-path description");
        this.paragraph(document, path.description);
      }

      if (path.bandNarrative) {
        document.moveDown(0.5);
        document
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor(INK)
          .text("Published recommendation interpretation");
        this.paragraph(document, path.bandNarrative);
      }

      document.moveDown(0.6);
      document
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(INK)
        .text("Recorded CareerFit evidence");
      if (path.evidence.length === 0) {
        this.mutedText(
          document,
          "No human-readable evidence fields were supplied by the algorithm output.",
        );
      } else {
        path.evidence.forEach((line) => this.bullet(document, line));
      }

      document.moveDown(0.7);
      this.noteBox(
        document,
        "DISCUSSION PROMPT",
        "What attracts you to this path? What assumptions should be tested through projects, conversations, observation or counseling before making an education decision?",
      );
    }
  }

  private renderDecisionMatrix(document: PDFKit.PDFDocument, careerPaths: CareerPathView[]): void {
    this.newPage(
      document,
      "Career Decision Matrix",
      "A worksheet for combining CareerFit evidence with human priorities",
    );
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(
        "Use this page during counseling. The report supplies the ranked paths; personal priorities should be discussed and recorded rather than inferred by the renderer.",
        { width: CONTENT_WIDTH, lineGap: 3 },
      );
    document.moveDown(1);

    const headers = ["Career", "Fit", "Interest", "Exposure", "Decision"];
    const widths = [210, 62, 70, 70, 86];
    let x = LEFT;
    headers.forEach((header, index) => {
      document.rect(x, document.y, widths[index] ?? 60, 28).fill("#EEF3F9");
      document
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(BRAND)
        .text(header, x + 6, document.y + 9, {
          width: (widths[index] ?? 60) - 12,
        });
      x += widths[index] ?? 60;
    });
    document.y += 32;

    careerPaths.forEach((path) => {
      const rowY = document.y;
      document.rect(LEFT, rowY, CONTENT_WIDTH, 42).strokeColor(LINE).stroke();
      document
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(INK)
        .text(path.name, LEFT + 6, rowY + 8, { width: 198 });
      document
        .font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text(`#${path.rank}`, LEFT + 216, rowY + 8, { width: 50 });
      document.text("________", LEFT + 278, rowY + 8, { width: 60 });
      document.text("________", LEFT + 348, rowY + 8, { width: 60 });
      document.text("________", LEFT + 418, rowY + 8, { width: 70 });
      document.y = rowY + 46;
    });
  }

  private renderEducationRoadmap(
    document: PDFKit.PDFDocument,
    payload: AssessmentReportPayloadV3,
  ): void {
    this.newPage(
      document,
      "Education Roadmap",
      "Translate the assessment into informed education exploration",
    );
    const guidance = asRecord(payload.guidanceContent);
    const text = narrative(
      guidance?.educationRoadmap ?? guidance?.subjectStreamGuidance ?? guidance,
    );

    if (text) {
      this.paragraph(document, text);
    } else {
      this.numberedPoint(
        document,
        1,
        "Clarify the target",
        "Shortlist two to four career paths for deeper exploration rather than choosing from the full list at once.",
      );
      this.numberedPoint(
        document,
        2,
        "Identify prerequisites",
        "Record the subject, qualification, entrance, portfolio, apprenticeship or skill prerequisites for each shortlisted path.",
      );
      this.numberedPoint(
        document,
        3,
        "Compare routes",
        "List at least two education routes for each priority path, including alternatives if the first route is unavailable.",
      );
      this.numberedPoint(
        document,
        4,
        "Test the fit",
        "Use projects, shadowing, internships, competitions, conversations or introductory courses to reduce uncertainty.",
      );
      this.numberedPoint(
        document,
        5,
        "Review with a counselor",
        "Convert the evidence into a documented subject/stream or education decision only after reviewing constraints and aspirations.",
      );
      document.moveDown(1);
      this.mutedText(
        document,
        "No individualized education-guidance content was frozen into this snapshot; this page is a planning framework only.",
      );
    }
  }

  private renderDevelopmentPlan(
    document: PDFKit.PDFDocument,
    payload: AssessmentReportPayloadV3,
  ): void {
    this.newPage(
      document,
      "90-Day Development Plan",
      "Move from assessment insight to observable action",
    );
    const guidance = asRecord(payload.guidanceContent);
    const text = narrative(guidance?.developmentPlan);
    if (text) this.paragraph(document, text);

    const rows = [
      ["Priority 1", "What will I explore or improve?", "Evidence of progress"],
      ["Priority 2", "What project/course/conversation will I complete?", "Evidence of progress"],
      ["Priority 3", "What career assumption will I test?", "Evidence of progress"],
      ["Review", "What changed in my understanding?", "Next decision"],
    ];

    for (const [label, action, evidence] of rows) {
      const y = document.y;
      document.roundedRect(LEFT, y, CONTENT_WIDTH, 92, 6).strokeColor(LINE).stroke();
      document
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(BRAND)
        .text(label ?? "", LEFT + 12, y + 12);
      document
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(MUTED)
        .text(action ?? "", LEFT + 12, y + 34, { width: 220 });
      document.text(evidence ?? "", LEFT + 255, y + 34, { width: 220 });
      document.y = y + 104;
    }
  }

  private renderCounselorDiscussion(
    document: PDFKit.PDFDocument,
    payload: AssessmentReportPayloadV3,
  ): void {
    this.newPage(
      document,
      "Counselor Discussion Page",
      "Capture human interpretation, questions and agreed actions",
    );
    const annotation = narrative(payload.counselorAnnotation);
    if (annotation) {
      document
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(INK)
        .text("Recorded counselor annotation");
      this.paragraph(document, annotation);
      document.moveDown(0.8);
    }

    for (const title of [
      "Key patterns we agree are meaningful",
      "Contradictions or uncertainties to investigate",
      "Priority career/education options for exploration",
      "Agreed next actions and review date",
    ]) {
      const y = document.y;
      document.font("Helvetica-Bold").fontSize(9.5).fillColor(BRAND).text(title, LEFT, y);
      document
        .roundedRect(LEFT, y + 18, CONTENT_WIDTH, 92, 5)
        .strokeColor(LINE)
        .stroke();
      document.y = y + 126;
    }
  }

  private renderProvenance(
    document: PDFKit.PDFDocument,
    payload: AssessmentReportPayloadV3,
    snapshot: ReportSnapshot,
  ): void {
    this.newPage(
      document,
      "Scientific and Technical Provenance",
      "Exact configuration frozen into this report snapshot",
    );
    const assessment = asRecord(payload.assessment);
    const scoring = asRecord(payload.scoring);
    const interpretation = asRecord(payload.interpretation);
    const careerFit = asRecord(payload.careerFit);
    const model = asRecord(careerFit?.model);
    const taxonomy = asRecord(careerFit?.taxonomy);

    this.keyValue(document, "Snapshot schema", "assessment-report-data-v3");
    this.keyValue(
      document,
      "Assessment version ID",
      asString(assessment?.assessmentVersionId) ?? "—",
    );
    this.keyValue(document, "Scoring version", asString(scoring?.scoringVersion) ?? "—");
    this.keyValue(document, "Scoring algorithm", asString(scoring?.algorithmVersion) ?? "—");
    this.keyValue(document, "Norm version", asString(assessment?.normVersion) ?? "—");
    this.keyValue(document, "Interpretation version", asString(interpretation?.version) ?? "—");
    this.keyValue(document, "CareerFit model", asString(model?.name) ?? "Not included");
    this.keyValue(document, "CareerFit model version", asString(model?.version) ?? "—");
    this.keyValue(document, "Career taxonomy version", asString(taxonomy?.version) ?? "—");
    this.keyValue(document, "Career taxonomy edition", asString(taxonomy?.edition) ?? "—");
    this.keyValue(document, "Report version", snapshot.reportVersion);

    this.newPage(document, "Immutable Evidence Record", "Hashes and reproducibility identifiers");
    this.hashBlock(document, "Scoring input hash", asString(scoring?.scoringInputHash) ?? "—");
    if (careerFit)
      this.hashBlock(document, "CareerFit input hash", asString(careerFit.inputHash) ?? "—");
    this.hashBlock(document, "Report snapshot hash", snapshot.inputHash);
    document.moveDown(0.8);
    this.noteBox(
      document,
      "IMMUTABILITY",
      "This report is rendered from a stored report-data snapshot. Historical PDFs can therefore be reproduced from the exact assessment, scoring, norm, interpretation and CareerFit versions recorded at generation time.",
    );
  }

  private constructCard(document: PDFKit.PDFDocument, construct: ConstructView): void {
    const startY = document.y;
    document.roundedRect(LEFT, startY, CONTENT_WIDTH, 188, 8).fillAndStroke(PANEL, LINE);
    document
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor(INK)
      .text(construct.name, LEFT + 14, startY + 14, {
        width: CONTENT_WIDTH - 28,
      });
    document
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(construct.code, LEFT + 14, startY + 35);

    const scoreY = startY + 58;
    const columnWidth = (CONTENT_WIDTH - 28) / 3;
    const values = [
      ["Raw", construct.rawScore],
      ["Standardized", construct.standardizedScore ?? "—"],
      ["Percentile", construct.percentile ?? "—"],
    ];
    values.forEach(([label, value], index) => {
      const x = LEFT + 14 + index * columnWidth;
      document
        .font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text(label ?? "", x, scoreY, { width: columnWidth - 8 });
      document
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(BRAND)
        .text(value ?? "—", x, scoreY + 16, { width: columnWidth - 8 });
    });

    document
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(BRAND)
      .text("PUBLISHED INTERPRETATION", LEFT + 14, startY + 106);
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#344054")
      .text(construct.interpretation, LEFT + 14, startY + 123, {
        width: CONTENT_WIDTH - 28,
        height: 52,
        ellipsis: true,
        lineGap: 2,
      });
    document.y = startY + 202;
  }

  private careerRankCard(
    document: PDFKit.PDFDocument,
    path: CareerPathView,
    expanded = false,
  ): void {
    const height = expanded ? 76 : 58;
    const y = document.y;
    document.roundedRect(LEFT, y, CONTENT_WIDTH, height, 6).fillAndStroke(PANEL, LINE);
    document
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .fillColor(INK)
      .text(`#${path.rank}  ${path.name}`, LEFT + 12, y + 11, {
        width: CONTENT_WIDTH - 145,
      });
    document
      .font("Helvetica")
      .fontSize(8.3)
      .fillColor(MUTED)
      .text(path.clusterName, LEFT + 12, y + 30, {
        width: CONTENT_WIDTH - 145,
      });
    if (expanded && path.bandLabel) {
      document
        .font("Helvetica")
        .fontSize(8.2)
        .fillColor(MUTED)
        .text(path.bandLabel, LEFT + 12, y + 47, {
          width: CONTENT_WIDTH - 145,
        });
    }
    document
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(BRAND)
      .text(path.score, PAGE_WIDTH - RIGHT - 110, y + 18, {
        width: 96,
        align: "right",
      });
    document.y = y + height + 8;
    document.x = LEFT;
  }

  private percentileBar(
    document: PDFKit.PDFDocument,
    label: string,
    percentileValue: number,
  ): void {
    const percentile = Math.max(
      0,
      Math.min(100, Number.isFinite(percentileValue) ? percentileValue : 0),
    );
    const y = document.y;
    document.font("Helvetica").fontSize(8.8).fillColor(INK).text(label, LEFT, y, { width: 190 });
    const barX = LEFT + 200;
    const barWidth = CONTENT_WIDTH - 245;
    document.roundedRect(barX, y + 1, barWidth, 9, 4).fill("#E8EEF6");
    document.roundedRect(barX, y + 1, barWidth * (percentile / 100), 9, 4).fill(BRAND);
    document
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(BRAND)
      .text(`P${percentile.toFixed(1)}`, PAGE_WIDTH - RIGHT - 40, y, {
        width: 40,
        align: "right",
      });
    document.y = y + 24;
    document.x = LEFT;
  }

  private definitionCard(document: PDFKit.PDFDocument, title: string, text: string): void {
    const y = document.y;
    document.roundedRect(LEFT, y, CONTENT_WIDTH, 92, 7).fillAndStroke(PANEL, LINE);
    document
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(BRAND)
      .text(title, LEFT + 14, y + 14);
    document
      .font("Helvetica")
      .fontSize(9.3)
      .fillColor("#344054")
      .text(text, LEFT + 14, y + 36, {
        width: CONTENT_WIDTH - 28,
        lineGap: 3,
      });
    document.y = y + 104;
  }

  private numberedPoint(
    document: PDFKit.PDFDocument,
    number: number,
    title: string,
    text: string,
  ): void {
    const y = document.y;
    document.circle(LEFT + 17, y + 17, 14).fill(BRAND);
    document
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#FFFFFF")
      .text(String(number), LEFT + 10, y + 11, {
        width: 14,
        align: "center",
      });
    document
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(INK)
      .text(title, LEFT + 44, y + 3, {
        width: CONTENT_WIDTH - 44,
      });
    document
      .font("Helvetica")
      .fontSize(9.3)
      .fillColor("#344054")
      .text(text, LEFT + 44, y + 23, {
        width: CONTENT_WIDTH - 44,
        lineGap: 3,
      });
    document.y = Math.max(document.y + 12, y + 78);
  }

  private bullet(document: PDFKit.PDFDocument, text: string): void {
    const y = document.y;
    document.circle(LEFT + 4, y + 6, 2.2).fill(BRAND);
    document
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor("#344054")
      .text(text, LEFT + 14, y, {
        width: CONTENT_WIDTH - 14,
        lineGap: 3,
      });
    document.moveDown(0.55);
  }

  private paragraph(document: PDFKit.PDFDocument, text: string): void {
    document.font("Helvetica").fontSize(9.5).fillColor("#344054").text(text, {
      width: CONTENT_WIDTH,
      lineGap: 3,
    });
    document.moveDown(0.7);
  }

  private mutedText(document: PDFKit.PDFDocument, text: string): void {
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(text, { width: CONTENT_WIDTH, lineGap: 3 });
    document.moveDown(0.6);
  }

  private noteBox(document: PDFKit.PDFDocument, title: string, text: string): void {
    const height = 94;
    const y = document.y;
    document.roundedRect(LEFT, y, CONTENT_WIDTH, height, 8).fillAndStroke("#F4F7FB", "#D6E0EE");
    document
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor(BRAND)
      .text(title, LEFT + 14, y + 13);
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#475467")
      .text(text, LEFT + 14, y + 34, {
        width: CONTENT_WIDTH - 28,
        lineGap: 3,
      });
    document.y = y + height + 12;
  }

  private contactBlock(document: PDFKit.PDFDocument): void {
    const y = document.y;
    const height = 104;
    document.roundedRect(LEFT, y, CONTENT_WIDTH, height, 8).fillAndStroke("#FFF8F1", "#F5CBA7");
    document
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor(ACCENT)
      .text("THE EDUMALL CONTACT", LEFT + 14, y + 13);
    document
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(INK)
      .text(`Phone: ${REPORT_PHONE_PRIMARY} | ${REPORT_PHONE_SECONDARY}`, LEFT + 14, y + 34, {
        width: CONTENT_WIDTH - 28,
      });
    document
      .font("Helvetica")
      .fontSize(8.8)
      .fillColor("#475467")
      .text(`Email: ${REPORT_EMAIL} | Web: ${REPORT_WEBSITE}`, LEFT + 14, y + 54, {
        width: CONTENT_WIDTH - 28,
      });
    document.text(`Address: ${REPORT_ADDRESS}`, LEFT + 14, y + 73, {
      width: CONTENT_WIDTH - 28,
    });
    document.y = y + height + 8;
    document.x = LEFT;
  }

  private keyValue(document: PDFKit.PDFDocument, label: string, value: string): void {
    const y = document.y;
    document.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(label, LEFT, y, { width: 150 });
    document
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor(INK)
      .text(value, LEFT + 155, y, {
        width: CONTENT_WIDTH - 155,
      });
    document.y = Math.max(document.y, y + 22);
    document.x = LEFT;
  }

  private hashBlock(document: PDFKit.PDFDocument, label: string, value: string): void {
    document.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(label);
    document.moveDown(0.3);
    const y = document.y;
    document.roundedRect(LEFT, y, CONTENT_WIDTH, 44, 5).fill(PANEL);
    document
      .font("Courier")
      .fontSize(7.5)
      .fillColor("#344054")
      .text(value, LEFT + 10, y + 12, {
        width: CONTENT_WIDTH - 20,
      });
    document.y = y + 58;
  }

  private newPage(document: PDFKit.PDFDocument, title: string, subtitle: string): void {
    document.addPage();
    document.fillColor(BRAND).font("Helvetica-Bold").fontSize(22).text(title, LEFT, TOP, {
      width: CONTENT_WIDTH,
    });
    document.moveDown(0.25).font("Helvetica").fontSize(9.5).fillColor(MUTED).text(subtitle, {
      width: CONTENT_WIDTH,
      lineGap: 2,
    });
    document.moveDown(1.2);
  }

  private formatDate(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(date);
  }

  private addFooters(document: PDFKit.PDFDocument, _snapshot: ReportSnapshot): void {
    const range = document.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      document.switchToPage(index);
      const footerY = PAGE_HEIGHT - 36;
      const originalBottomMargin = document.page.margins.bottom;
      document.page.margins.bottom = 0;
      document
        .moveTo(LEFT, footerY - 8)
        .lineTo(PAGE_WIDTH - RIGHT, footerY - 8)
        .strokeColor(LINE)
        .lineWidth(0.6)
        .stroke();
      document
        .font("Helvetica")
        .fontSize(6.6)
        .fillColor("#98A2B3")
        .text(
          `The EduMall | ${REPORT_PHONE_PRIMARY} | ${REPORT_PHONE_SECONDARY} | ${REPORT_EMAIL} | ${REPORT_WEBSITE}`,
          LEFT,
          footerY,
          {
            width: CONTENT_WIDTH - 72,
            lineBreak: false,
          },
        );
      document.text(
        `Page ${index - range.start + 1} of ${range.count}`,
        PAGE_WIDTH - RIGHT - 64,
        footerY,
        {
          width: 64,
          align: "right",
          lineBreak: false,
        },
      );
      document.page.margins.bottom = originalBottomMargin;
      document.x = LEFT;
    }
  }
}
