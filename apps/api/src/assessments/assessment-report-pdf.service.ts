import { ConflictException, Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { CareerIntelligenceReportPdfRenderer } from "./career-intelligence-report-pdf.renderer";

interface ReportPayload {
  schemaVersion: string;
  candidate?: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  submission?: {
    attemptId: string;
    startedAt: string;
    submittedAt: string | null;
  };
  assessment: {
    assessmentVersionId: string;
    assessmentDefinitionCode?: string;
    versionNumber: number;
    title: string;
    edition: string;
    form: string;
    language: string;
    scoringVersion: string;
    normVersion: string;
    reportVersion: string;
  };
  scoring: {
    scoringRunId: string;
    attemptId: string;
    scoringVersion: string;
    algorithmVersion: string;
    scoringInputHash: string;
    calculatedAt: string;
    constructs: Array<{
      assessmentConstructId: string;
      code: string;
      name: string;
      orderIndex: number;
      rawScore: string;
      answeredItemCount: number;
      contributionCount: number;
    }>;
  };
  norms: Array<{
    assessmentConstructId: string;
    standardizedScore: string | null;
    percentile: string | null;
  }>;
  interpretation: {
    interpretationSetId: string;
    version: string;
    name: string;
    applications: Array<{
      assessmentConstructId: string;
      ruleCode: string;
      metric: string;
      metricValue: string;
      outputData: unknown;
    }>;
  };
}

interface ReportSnapshot {
  id: string;
  inputHash: string;
  reportVersion: string;
  generatedAt: Date | string;
  payload: unknown;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 54;
const RIGHT = 54;
const TOP = 54;
const BOTTOM = 62;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;

@Injectable()
export class AssessmentReportPdfService {
  public async render(snapshot: ReportSnapshot): Promise<Buffer> {
    if (
      typeof snapshot.payload === "object" &&
      snapshot.payload !== null &&
      "schemaVersion" in snapshot.payload &&
      (snapshot.payload as { schemaVersion?: unknown }).schemaVersion ===
        "assessment-report-data-v3"
    ) {
      return new CareerIntelligenceReportPdfRenderer().render(snapshot);
    }

    const payload = this.parsePayload(snapshot.payload);

    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({
        size: "A4",
        margins: {
          top: TOP,
          right: RIGHT,
          bottom: BOTTOM,
          left: LEFT,
        },
        bufferPages: true,
        info: {
          Title: `${payload.assessment.title} - Assessment Report`,
          Author: "The EduMall",
          Subject: "Governed Psychometric Assessment Report",
          Keywords: "assessment, psychometric, report, EduMall",
          CreationDate: new Date(snapshot.generatedAt),
        },
      });

      const chunks: Buffer[] = [];

      document.on("data", (chunk: Buffer | Uint8Array) => {
        chunks.push(Buffer.from(chunk));
      });

      document.on("error", reject);

      document.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      this.renderCover(document, payload, snapshot);
      this.renderResults(document, payload);
      this.renderProvenance(document, payload, snapshot);
      this.addFooters(document, snapshot);

      document.end();
    });
  }

  private parsePayload(value: unknown): ReportPayload {
    if (
      typeof value !== "object" ||
      value === null ||
      !("schemaVersion" in value) ||
      !("assessment" in value) ||
      !("scoring" in value) ||
      !("norms" in value) ||
      !("interpretation" in value)
    ) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_SNAPSHOT_INVALID",
        message: "The immutable report snapshot is not valid for PDF rendering.",
      });
    }

    const payload = value as ReportPayload;

    if (
      payload.schemaVersion !== "assessment-report-data-v1" &&
      payload.schemaVersion !== "assessment-report-data-v2"
    ) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_SCHEMA_UNSUPPORTED",
        message: "The report snapshot schema is not supported by this PDF renderer.",
      });
    }

    if (
      !Array.isArray(payload.scoring.constructs) ||
      !Array.isArray(payload.norms) ||
      !Array.isArray(payload.interpretation.applications)
    ) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_SNAPSHOT_INVALID",
        message: "The immutable report snapshot contains invalid report data.",
      });
    }

    return payload;
  }

  private renderCover(
    document: PDFKit.PDFDocument,
    payload: ReportPayload,
    snapshot: ReportSnapshot,
  ): void {
    document.rect(0, 0, PAGE_WIDTH, 165).fill("#173A70");

    document
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("THE EDUMALL", LEFT, 52, {
        characterSpacing: 1.8,
      });

    document.font("Helvetica-Bold").fontSize(29).text("Psychometric Assessment", LEFT, 78, {
      width: CONTENT_WIDTH,
    });

    document
      .font("Helvetica")
      .fontSize(18)
      .fillColor("#DCE8F8")
      .text("Governed Result Report", LEFT, 116);

    document.y = 205;

    document
      .fillColor("#172033")
      .font("Helvetica-Bold")
      .fontSize(23)
      .text(payload.assessment.title);

    const code = payload.assessment.assessmentDefinitionCode;

    document
      .moveDown(0.35)
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor("#667085")
      .text(
        [
          code ? `Assessment: ${code}` : null,
          `Version ${payload.assessment.versionNumber}`,
          `Edition ${payload.assessment.edition}`,
          `Form ${payload.assessment.form}`,
          `Language ${payload.assessment.language}`,
        ]
          .filter(Boolean)
          .join("  |  "),
      );

    document.moveDown(2);

    if (payload.candidate) {
      this.keyValue(
        document,
        "Candidate",
        `${payload.candidate.firstName} ${payload.candidate.lastName}`,
      );

      this.keyValue(document, "Email", payload.candidate.email);
    } else {
      this.keyValue(document, "Candidate", "Identity was not captured in this legacy snapshot.");
    }

    if (payload.submission?.submittedAt) {
      this.keyValue(document, "Submitted", this.formatDate(payload.submission.submittedAt));
    }

    this.keyValue(document, "Report generated", this.formatDate(snapshot.generatedAt));

    document.moveDown(1.7);

    this.ensureSpace(document, 120);

    const boxY = document.y;

    document.roundedRect(LEFT, boxY, CONTENT_WIDTH, 102, 8).fillAndStroke("#F4F7FB", "#D6E0EE");

    document
      .fillColor("#173A70")
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .text("IMPORTANT REPORT NOTE", LEFT + 16, boxY + 15);

    document
      .fillColor("#475467")
      .font("Helvetica")
      .fontSize(9.5)
      .text(
        "This document reproduces the stored assessment outputs from the immutable report snapshot. Scores, percentiles and interpretations shown here come only from the published scoring, norm and interpretation configuration recorded for this assessment. This document does not independently create a diagnosis or new psychometric conclusion.",
        LEFT + 16,
        boxY + 37,
        {
          width: CONTENT_WIDTH - 32,
          lineGap: 3,
        },
      );

    document.y = boxY + 125;
  }

  private renderResults(document: PDFKit.PDFDocument, payload: ReportPayload): void {
    document.addPage();

    this.sectionTitle(
      document,
      "Assessment Results",
      "Recorded construct scores and published interpretations",
    );

    const normByConstruct = new Map(
      payload.norms.map((norm) => [norm.assessmentConstructId, norm]),
    );

    const interpretationByConstruct = new Map(
      payload.interpretation.applications.map((application) => [
        application.assessmentConstructId,
        application,
      ]),
    );

    for (const construct of payload.scoring.constructs) {
      this.ensureSpace(document, 155);

      const norm = normByConstruct.get(construct.assessmentConstructId);

      const interpretation = interpretationByConstruct.get(construct.assessmentConstructId);

      document.font("Helvetica-Bold").fontSize(15).fillColor("#172033").text(construct.name);

      document
        .moveDown(0.2)
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#667085")
        .text(construct.code);

      document.moveDown(0.7);

      const scoreY = document.y;

      const columns = [
        ["Raw score", construct.rawScore],
        ["Standardized", norm?.standardizedScore ?? "-"],
        ["Percentile", norm?.percentile ?? "-"],
      ] as const;

      const columnWidth = CONTENT_WIDTH / 3;

      columns.forEach(([label, value], index) => {
        const x = LEFT + columnWidth * index;

        document.roundedRect(x, scoreY, columnWidth - 8, 52, 5).fill("#F7F9FC");

        document
          .fillColor("#667085")
          .font("Helvetica")
          .fontSize(8.5)
          .text(label, x + 10, scoreY + 9, {
            width: columnWidth - 28,
          });

        document
          .fillColor("#172033")
          .font("Helvetica-Bold")
          .fontSize(14)
          .text(String(value), x + 10, scoreY + 27, {
            width: columnWidth - 28,
          });
      });

      document.x = LEFT;
      document.y = scoreY + 68;

      document
        .fillColor("#173A70")
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .text("PUBLISHED INTERPRETATION");

      document.moveDown(0.45);

      document
        .fillColor("#344054")
        .font("Helvetica")
        .fontSize(10)
        .text(
          interpretation
            ? this.stringifyOutput(interpretation.outputData)
            : "No published interpretation application is present in this snapshot.",
          {
            width: CONTENT_WIDTH,
            lineGap: 3,
          },
        );

      if (interpretation) {
        document
          .moveDown(0.45)
          .fontSize(8.5)
          .fillColor("#667085")
          .text(
            `Rule ${interpretation.ruleCode} | ${interpretation.metric} = ${interpretation.metricValue}`,
          );
      }

      document.moveDown(1.2);

      document
        .moveTo(LEFT, document.y)
        .lineTo(PAGE_WIDTH - RIGHT, document.y)
        .strokeColor("#E4E7EC")
        .lineWidth(0.7)
        .stroke();

      document.moveDown(1.2);
    }
  }

  private renderProvenance(
    document: PDFKit.PDFDocument,
    payload: ReportPayload,
    snapshot: ReportSnapshot,
  ): void {
    document.addPage();

    this.sectionTitle(
      document,
      "Report Provenance",
      "Technical record of the exact configuration used",
    );

    this.keyValue(document, "Snapshot schema", payload.schemaVersion);

    this.keyValue(document, "Assessment version ID", payload.assessment.assessmentVersionId);

    this.keyValue(document, "Scoring version", payload.scoring.scoringVersion);

    this.keyValue(document, "Scoring algorithm", payload.scoring.algorithmVersion);

    this.keyValue(document, "Norm version", payload.assessment.normVersion);

    this.keyValue(
      document,
      "Interpretation set",
      `${payload.interpretation.name} (${payload.interpretation.version})`,
    );

    this.keyValue(document, "Report version", snapshot.reportVersion);

    document.moveDown(1);

    this.hashBlock(document, "Scoring input hash", payload.scoring.scoringInputHash);

    this.hashBlock(document, "Report snapshot hash", snapshot.inputHash);

    document.moveDown(1.2);

    document
      .roundedRect(LEFT, document.y, CONTENT_WIDTH, 80, 8)
      .fillAndStroke("#F4F7FB", "#D6E0EE");

    const noteY = document.y + 14;

    document
      .fillColor("#173A70")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("IMMUTABILITY", LEFT + 15, noteY);

    document
      .fillColor("#475467")
      .font("Helvetica")
      .fontSize(9.5)
      .text(
        "This PDF is rendered from the stored report-data snapshot. The snapshot records the assessment, scoring, normalization and interpretation provenance used when the report was generated.",
        LEFT + 15,
        noteY + 20,
        {
          width: CONTENT_WIDTH - 30,
          lineGap: 3,
        },
      );
  }

  private sectionTitle(document: PDFKit.PDFDocument, title: string, subtitle: string): void {
    document.fillColor("#173A70").font("Helvetica-Bold").fontSize(22).text(title);

    document.moveDown(0.3).fillColor("#667085").font("Helvetica").fontSize(10).text(subtitle);

    document.moveDown(1.4);
  }

  private keyValue(document: PDFKit.PDFDocument, label: string, value: string): void {
    this.ensureSpace(document, 38);

    const y = document.y;

    document.font("Helvetica").fontSize(9).fillColor("#667085").text(label, LEFT, y, {
      width: 145,
    });

    document
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#172033")
      .text(value, LEFT + 150, y, {
        width: CONTENT_WIDTH - 150,
      });

    document.y = Math.max(document.y, y + 24);
  }

  private hashBlock(document: PDFKit.PDFDocument, label: string, value: string): void {
    this.ensureSpace(document, 68);

    document.fillColor("#667085").font("Helvetica").fontSize(9).text(label);

    document.moveDown(0.35);

    const y = document.y;

    document.roundedRect(LEFT, y, CONTENT_WIDTH, 42, 5).fill("#F7F9FC");

    document
      .fillColor("#344054")
      .font("Courier")
      .fontSize(7.8)
      .text(value, LEFT + 10, y + 11, {
        width: CONTENT_WIDTH - 20,
      });

    document.y = y + 56;
  }

  private ensureSpace(document: PDFKit.PDFDocument, requiredHeight: number): void {
    if (document.y + requiredHeight > PAGE_HEIGHT - BOTTOM) {
      document.addPage();
    }
  }

  private stringifyOutput(value: unknown): string {
    if (value === null || value === undefined) {
      return "No narrative output supplied.";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return JSON.stringify(value, null, 2);
  }

  private formatDate(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(date);
  }

  private addFooters(document: PDFKit.PDFDocument, snapshot: ReportSnapshot): void {
    const range = document.bufferedPageRange();

    for (let index = range.start; index < range.start + range.count; index += 1) {
      document.switchToPage(index);

      const footerY = PAGE_HEIGHT - 38;
      const originalBottomMargin = document.page.margins.bottom;

      document.page.margins.bottom = 0;

      document
        .moveTo(LEFT, footerY - 8)
        .lineTo(PAGE_WIDTH - RIGHT, footerY - 8)
        .strokeColor("#E4E7EC")
        .lineWidth(0.6)
        .stroke();

      document
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#98A2B3")
        .text(`The EduMall | Immutable report snapshot ${snapshot.id}`, LEFT, footerY, {
          width: CONTENT_WIDTH - 80,
          lineBreak: false,
        });

      document.text(
        `Page ${index - range.start + 1} of ${range.count}`,
        PAGE_WIDTH - RIGHT - 75,
        footerY,
        {
          width: 75,
          align: "right",
          lineBreak: false,
        },
      );

      document.page.margins.bottom = originalBottomMargin;
    }
  }
}
