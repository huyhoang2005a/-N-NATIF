import type { CreateResearchProposalRequest, RejectResearchProposalRequest, ResearchProposalResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertActiveMember } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { AuthorVerificationStatus, CaseOriginType, ConflictError, ErrorCode, ForbiddenError, NotFoundError, ProposalStatus } from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../../database/database.module";
import { AuditService } from "../../platform-operations/audit/audit.service";
import { TechnologyCaseService } from "../../technology-case/technology-case.service";
import { assertProposalTransition } from "../domain/research-proposal.state-machine";
import { ResearchNeedsRepository } from "../research-needs/research-needs.repository";
import { ProposalsRepository } from "./proposals.repository";

function toProposalResponse(row: {
  id: string;
  researchNeedId: string;
  needStatementVersionId: string;
  proposerAuthorUserId: string;
  proposerOrganizationId: string;
  title: string;
  abstract: string;
  methodology: string;
  expectedOutcome: string;
  timelineMonths: number;
  status: string;
  submittedAt: Date | null;
  decidedByUserId: string | null;
  decisionReason: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}): ResearchProposalResponse {
  return {
    id: row.id,
    researchNeedId: row.researchNeedId,
    needStatementVersionId: row.needStatementVersionId,
    proposerAuthorUserId: row.proposerAuthorUserId,
    proposerOrganizationId: row.proposerOrganizationId,
    title: row.title,
    abstract: row.abstract,
    methodology: row.methodology,
    expectedOutcome: row.expectedOutcome,
    timelineMonths: row.timelineMonths,
    status: row.status,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    decidedByUserId: row.decidedByUserId,
    decisionReason: row.decisionReason,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

/** UC-DIS-02. Bounded context: Company & Discovery. */
@Injectable()
export class ProposalsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly repository: ProposalsRepository,
    private readonly needsRepository: ResearchNeedsRepository,
    private readonly technologyCaseService: TechnologyCaseService,
    private readonly auditService: AuditService,
  ) {}

  /** UC-DIS-02 precondition: "Author VERIFIED. ResearchNeed OPEN và PUBLIC." — proposals can
   * only target needs an author could actually discover via public browse (Sprint 5.2's
   * `GET /research-needs` listing), not needs merely visible-if-member. */
  async create(
    actor: ActorContext,
    researchNeedId: string,
    request: CreateResearchProposalRequest,
    requestIdHeader: string | null,
  ): Promise<ResearchProposalResponse> {
    if (actor.authorVerificationStatus !== AuthorVerificationStatus.VERIFIED) {
      throw new ForbiddenError(ErrorCode.DISCOVERY_AUTHOR_NOT_VERIFIED, "Only a verified author may submit a research proposal.");
    }
    assertActiveMember(actor, request.proposerOrganizationId);

    const need = await this.needsRepository.findById(researchNeedId);
    if (!need || need.status !== "OPEN" || need.visibility !== "PUBLIC") {
      throw new ConflictError(ErrorCode.DISCOVERY_NEED_NOT_OPEN, "Research need is not open for proposals.");
    }
    const currentVersion = await this.needsRepository.findLatestVersion(researchNeedId);
    if (!currentVersion) {
      throw new Error(`Research need ${researchNeedId} has no statement version — data integrity violation.`);
    }

    const proposal = await this.db.transaction(async (tx) => {
      const created = await this.repository.create(
        {
          researchNeedId,
          needStatementVersionId: currentVersion.id,
          proposerAuthorUserId: actor.userId,
          proposerOrganizationId: request.proposerOrganizationId,
          title: request.title,
          abstract: request.abstract,
          methodology: request.methodology,
          expectedOutcome: request.expectedOutcome,
          timelineMonths: request.timelineMonths,
          status: ProposalStatus.SUBMITTED,
          submittedAt: new Date(),
        },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: request.proposerOrganizationId,
          requestId: requestIdHeader,
          action: "research_proposal.create",
          entityType: "research_proposal",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );
      return created;
    });

    return toProposalResponse(proposal);
  }

  private async loadForCompanyAction(actor: ActorContext, proposalId: string) {
    const proposal = await this.repository.findById(proposalId);
    if (!proposal) {
      throw new NotFoundError(ErrorCode.DISCOVERY_PROPOSAL_STATE_INVALID, "Research proposal not found.");
    }
    const need = await this.needsRepository.findById(proposal.researchNeedId);
    if (!need) {
      throw new Error(`Research need ${proposal.researchNeedId} for proposal ${proposalId} not found — data integrity violation.`);
    }
    assertActiveMember(actor, need.companyOrganizationId);
    return { proposal, need };
  }

  async review(actor: ActorContext, proposalId: string, requestIdHeader: string | null): Promise<ResearchProposalResponse> {
    const { proposal } = await this.loadForCompanyAction(actor, proposalId);
    assertProposalTransition(proposal.status as ProposalStatus, ProposalStatus.UNDER_REVIEW);

    const updated = await this.db.transaction(async (tx) => {
      const result = await this.repository.update(proposalId, proposal.version, { status: ProposalStatus.UNDER_REVIEW }, tx);
      if (!result) {
        throw new ConflictError(ErrorCode.DISCOVERY_PROPOSAL_STATE_INVALID, "Proposal was modified concurrently — retry.");
      }
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          requestId: requestIdHeader,
          action: "research_proposal.review",
          entityType: "research_proposal",
          entityId: proposalId,
          beforeData: proposal,
          afterData: result,
        },
        tx,
      );
      return result;
    });

    return toProposalResponse(updated);
  }

  async reject(
    actor: ActorContext,
    proposalId: string,
    request: RejectResearchProposalRequest,
    requestIdHeader: string | null,
  ): Promise<ResearchProposalResponse> {
    const { proposal } = await this.loadForCompanyAction(actor, proposalId);
    assertProposalTransition(proposal.status as ProposalStatus, ProposalStatus.REJECTED);

    const updated = await this.db.transaction(async (tx) => {
      const result = await this.repository.update(
        proposalId,
        proposal.version,
        {
          status: ProposalStatus.REJECTED,
          decidedByUserId: actor.userId,
          decisionReason: request.decisionReason,
          decidedAt: new Date(),
        },
        tx,
      );
      if (!result) {
        throw new ConflictError(ErrorCode.DISCOVERY_PROPOSAL_STATE_INVALID, "Proposal was modified concurrently — retry.");
      }
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          requestId: requestIdHeader,
          action: "research_proposal.reject",
          entityType: "research_proposal",
          entityId: proposalId,
          beforeData: proposal,
          afterData: result,
        },
        tx,
      );
      return result;
    });

    return toProposalResponse(updated);
  }

  /** UC-DIS-02 step 6 + `06` Sprint 5.3 item 9: accept creates the Technology Case
   * (`case_origin=RESEARCH_PROPOSAL`) in the SAME transaction as the proposal's own
   * ACCEPTED update, via `TechnologyCaseService.createCaseCore` — the one shared
   * case-creation code path, not a second copy. Case is owned by the proposer's
   * organization/author (they do the work); the accepting company is linked as
   * `PARTNER_COMPANY`/`PARTNER_MEMBER`. */
  async accept(actor: ActorContext, proposalId: string, requestIdHeader: string | null): Promise<ResearchProposalResponse> {
    const { proposal, need } = await this.loadForCompanyAction(actor, proposalId);
    assertProposalTransition(proposal.status as ProposalStatus, ProposalStatus.ACCEPTED);

    const updated = await this.db.transaction(async (tx) => {
      const technologyCase = await this.technologyCaseService.createCaseCore(tx, {
        owningOrganizationId: proposal.proposerOrganizationId,
        title: proposal.title,
        description: proposal.abstract,
        summary: proposal.expectedOutcome,
        ownerUserId: proposal.proposerAuthorUserId,
        createdByUserId: actor.userId,
        origin: { type: CaseOriginType.RESEARCH_PROPOSAL, researchProposalId: proposal.id },
        partnerOrganizationId: need.companyOrganizationId,
        partnerMemberUserId: actor.userId,
        auditActorUserId: actor.userId,
        requestIdHeader,
      });

      const result = await this.repository.update(
        proposalId,
        proposal.version,
        {
          status: ProposalStatus.ACCEPTED,
          decidedByUserId: actor.userId,
          decidedAt: new Date(),
        },
        tx,
      );
      if (!result) {
        throw new ConflictError(ErrorCode.DISCOVERY_PROPOSAL_STATE_INVALID, "Proposal was modified concurrently — retry.");
      }
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          requestId: requestIdHeader,
          action: "research_proposal.accept",
          entityType: "research_proposal",
          entityId: proposalId,
          beforeData: proposal,
          afterData: { ...result, technologyCaseId: technologyCase.id },
        },
        tx,
      );
      return result;
    });

    return toProposalResponse(updated);
  }

  /** Author self-withdraws — the only actor check here is proposal ownership, not
   * organization membership (matches UC-DIS-02 "Author rút proposal trước final decision"). */
  async withdraw(actor: ActorContext, proposalId: string, requestIdHeader: string | null): Promise<ResearchProposalResponse> {
    const proposal = await this.repository.findById(proposalId);
    if (!proposal) {
      throw new NotFoundError(ErrorCode.DISCOVERY_PROPOSAL_STATE_INVALID, "Research proposal not found.");
    }
    if (proposal.proposerAuthorUserId !== actor.userId) {
      throw new ForbiddenError(ErrorCode.AUTH_FORBIDDEN, "Only the proposal's author may withdraw it.");
    }
    assertProposalTransition(proposal.status as ProposalStatus, ProposalStatus.WITHDRAWN);

    const updated = await this.db.transaction(async (tx) => {
      const result = await this.repository.update(proposalId, proposal.version, { status: ProposalStatus.WITHDRAWN }, tx);
      if (!result) {
        throw new ConflictError(ErrorCode.DISCOVERY_PROPOSAL_STATE_INVALID, "Proposal was modified concurrently — retry.");
      }
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          requestId: requestIdHeader,
          action: "research_proposal.withdraw",
          entityType: "research_proposal",
          entityId: proposalId,
          beforeData: proposal,
          afterData: result,
        },
        tx,
      );
      return result;
    });

    return toProposalResponse(updated);
  }

  async listForNeed(actor: ActorContext, researchNeedId: string): Promise<ResearchProposalResponse[]> {
    const need = await this.needsRepository.findById(researchNeedId);
    if (!need) {
      throw new NotFoundError(ErrorCode.DISCOVERY_NEED_NOT_OPEN, "Research need not found.");
    }
    assertActiveMember(actor, need.companyOrganizationId);
    const proposals = await this.repository.listByNeed(researchNeedId);
    return proposals.map(toProposalResponse);
  }

  async listMine(actor: ActorContext): Promise<ResearchProposalResponse[]> {
    const proposals = await this.repository.listByAuthor(actor.userId);
    return proposals.map(toProposalResponse);
  }
}
