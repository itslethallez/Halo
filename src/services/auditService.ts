import { prisma } from "@/lib/prisma";

export interface RecordAuditInput {
  businessId: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Every mutation of a protected resource writes an audit row. See /docs/01-architecture.md §8. */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      businessId: input.businessId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata as never,
    },
  });
}
