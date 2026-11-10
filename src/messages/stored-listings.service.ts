import { Injectable } from '@nestjs/common';
import type { StoredListing } from '../generated/prisma/client';
import { DatabaseService } from '../database/database.service';
import {
  ListingResult,
  listingResultSchema,
  ProcessingFailure,
  StoredListingResult,
  storedListingResultSchema,
} from './message-result.schema';
import { ApprovalRequest } from './approval-request.schema';

/** Maps persisted current listing state to the public listing contract. */
@Injectable()
export class StoredListingsService {
  constructor(private readonly database: DatabaseService) {}

  async list(needsReview?: boolean): Promise<StoredListingResult[]> {
    const rows = await this.database.storedListing.findMany({
      where: needsReview === undefined ? undefined : { needsReview },
      orderBy: [
        { messageIngestionOrder: 'asc' },
        { offerIndex: 'asc' },
      ],
    });

    return rows.map(toStoredListingResult);
  }

  async approve(id: string, request: ApprovalRequest): Promise<StoredListingResult | ProcessingFailure> {
    const existing = await this.database.storedListing.findUnique({ where: { id } });
    if (!existing) return listingNotFoundFailure;
    if (!existing.originallyNeedsReview) return approvalConflictFailure;
    if (existing.approvalState === 'approved') return toStoredListingResult(existing);

    const approvedAt = new Date();
    const updated = await this.database.storedListing.updateMany({
      where: { id, approvalState: 'pending', originallyNeedsReview: true },
      data: {
        needsReview: false,
        approvalState: 'approved',
        approvedAt,
        approvalNote: request.note ?? null,
      },
    });

    const winner = await this.database.storedListing.findUnique({ where: { id } });
    if (!winner) return listingNotFoundFailure;
    if (updated.count === 0 && !winner.originallyNeedsReview) return approvalConflictFailure;
    return toStoredListingResult(winner);
  }
}

const listingNotFoundFailure: ProcessingFailure = {
  message_id: null,
  error: { code: 'listing_not_found', message: 'Listing not found' },
};

const approvalConflictFailure: ProcessingFailure = {
  message_id: null,
  error: { code: 'approval_conflict', message: 'Listing does not require approval' },
};

export function toListingResult(row: StoredListing): ListingResult {
  return listingResultSchema.parse({
    id: row.id,
    purpose: row.purpose,
    property_type: row.propertyType,
    city: row.city,
    district: row.district,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    area_sqm: row.areaSqm,
    price: {
      amount: row.priceAmount,
      currency: row.priceCurrency,
      period: row.pricePeriod,
    },
    contact_phone: row.contactPhone,
    needs_review: row.needsReview,
    review_reasons: JSON.parse(row.reviewReasons),
    duplicate_of: null,
  });
}

function toStoredListingResult(row: StoredListing): StoredListingResult {
  return storedListingResultSchema.parse({
    ...toListingResult(row),
    approval_note: row.approvalNote,
  });
}
