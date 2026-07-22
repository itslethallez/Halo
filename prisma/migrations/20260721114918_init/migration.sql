-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'WORKER', 'DRIVER', 'CLIENT');

-- CreateEnum
CREATE TYPE "ToneStyle" AS ENUM ('WARM_FRIENDLY', 'PROFESSIONAL', 'CASUAL', 'BRIEF_DIRECT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WorkerEarningsModel" AS ENUM ('COMMISSION', 'FLAT_RATE');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "BlockedTimeType" AS ENUM ('BLACKOUT', 'HOLIDAY', 'PERSONAL');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('NEW_ENQUIRY', 'AVAILABILITY_OFFERED', 'AWAITING_CLIENT_RESPONSE', 'AWAITING_DEPOSIT', 'AWAITING_WORKER_APPROVAL', 'CONFIRMED', 'DRIVER_REQUIRED', 'DRIVER_ASSIGNED', 'WORKER_EN_ROUTE', 'WORKER_ARRIVED', 'SERVICE_IN_PROGRESS', 'SERVICE_COMPLETED', 'AWAITING_WORKER_SURVEY', 'AWAITING_CLIENT_SURVEY', 'FULLY_COMPLETED', 'CANCELLED', 'NO_SHOW', 'SAFETY_REVIEW', 'BLOCKED');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('AI', 'WORKER', 'CLIENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ClientSafetyStatus" AS ENUM ('TRUSTED', 'STANDARD', 'MONITOR', 'MANUAL_REVIEW_REQUIRED', 'RESTRICTED', 'DO_NOT_BOOK', 'BLOCKED_PENDING_INVESTIGATION');

-- CreateEnum
CREATE TYPE "RestrictionType" AS ENUM ('DRIVER_MUST_REMAIN_NEARBY', 'DAYTIME_APPOINTMENTS_ONLY', 'FULL_PAYMENT_IN_ADVANCE', 'DEPOSIT_REQUIRED', 'HOTEL_RECEPTION_VERIFICATION_REQUIRED', 'ADDRESS_MUST_BE_CONFIRMED_BEFORE_TRAVEL', 'NO_ADDRESS_CHANGES_AFTER_CONFIRMATION', 'WORKER_MUST_SPEAK_BEFORE_APPROVAL', 'MANUAL_ADMIN_APPROVAL_REQUIRED', 'DO_NOT_ALLOCATE_SAME_WORKER', 'DO_NOT_ACCEPT_FUTURE_BOOKINGS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WorkerSafetyQ1" AS ENUM ('YES_COMPLETELY', 'MOSTLY', 'SLIGHTLY_UNCOMFORTABLE', 'FELT_UNSAFE');

-- CreateEnum
CREATE TYPE "WorkerSafetyQ2" AS ENUM ('YES_COMPLETELY', 'MOSTLY', 'MINOR_CONCERNS', 'INAPPROPRIATE_BEHAVIOUR');

-- CreateEnum
CREATE TYPE "WorkerSafetyQ3" AS ENUM ('ACCURATE', 'MOSTLY_ACCURATE', 'SOME_DETAILS_DIFFERENT', 'MISLEADING');

-- CreateEnum
CREATE TYPE "WorkerSafetyQ4" AS ENUM ('NO_ISSUES', 'MINOR_ISSUE', 'SIGNIFICANT_ISSUE', 'SERIOUS_INCIDENT');

-- CreateEnum
CREATE TYPE "WorkerSafetyQ5" AS ENUM ('YES', 'YES_WITH_CONDITIONS', 'MANUAL_APPROVAL_REQUIRED', 'NO_DO_NOT_ACCEPT');

-- CreateEnum
CREATE TYPE "ClientSatisfactionQ1" AS ENUM ('VERY_SATISFIED', 'SATISFIED', 'NEUTRAL', 'DISSATISFIED', 'VERY_DISSATISFIED');

-- CreateEnum
CREATE TYPE "ClientSatisfactionQ2" AS ENUM ('ON_TIME', 'SLIGHTLY_OFF', 'SIGNIFICANTLY_OFF', 'DID_NOT_PROCEED');

-- CreateEnum
CREATE TYPE "ClientSatisfactionQ3" AS ENUM ('YES_COMPLETELY', 'MOSTLY', 'NEEDS_IMPROVEMENT', 'NO');

-- CreateEnum
CREATE TYPE "ClientSatisfactionQ4" AS ENUM ('YES_COMPLETELY', 'MOSTLY', 'NOT_ENTIRELY', 'NO');

-- CreateEnum
CREATE TYPE "ClientSatisfactionQ5" AS ENUM ('DEFINITELY', 'PROBABLY', 'UNSURE', 'PROBABLY_NOT', 'DEFINITELY_NOT');

-- CreateEnum
CREATE TYPE "IncidentSource" AS ENUM ('WORKER_SURVEY', 'CLIENT_FEEDBACK', 'MANUAL_REPORT');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DriverJobLegType" AS ENUM ('OUTBOUND', 'RETURN');

-- CreateEnum
CREATE TYPE "DriverJobStatus" AS ENUM ('UNASSIGNED', 'OFFERED', 'ACCEPTED', 'DECLINED', 'EN_ROUTE_TO_WORKER', 'WORKER_COLLECTED', 'ARRIVED_AT_DESTINATION', 'WAITING', 'RETURN_TRIP_STARTED', 'WORKER_RETURNED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DriverPreference" AS ENUM ('PREFERRED', 'NOT_PREFERRED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DEPOSIT', 'BALANCE', 'TIP', 'FULL_PAYMENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FUEL', 'SUPPLIES', 'DRIVER_PAYMENT', 'PLATFORM_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_ENQUIRY', 'BOOKING_REQUEST', 'BOOKING_CONFIRMATION', 'DEPOSIT_REQUEST', 'PAYMENT_CONFIRMATION', 'APPOINTMENT_REMINDER', 'DRIVER_ASSIGNMENT', 'DRIVER_ARRIVAL', 'SAFETY_CHECKIN_REMINDER', 'MISSED_CHECKIN_ALERT', 'SURVEY_REMINDER', 'CANCELLATION', 'MANUAL_REVIEW', 'INCIDENT_REVIEW');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'EMAIL', 'SMS', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "ConsentPolicyType" AS ENUM ('PRIVACY_POLICY', 'TERMS_OF_SERVICE');

-- CreateEnum
CREATE TYPE "CorrectionRequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "workerEarningsModel" "WorkerEarningsModel" NOT NULL DEFAULT 'COMMISSION',
    "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
    "autoOfferTopDriver" BOOLEAN NOT NULL DEFAULT false,
    "shareSafetyStatusAcrossWorkers" BOOLEAN NOT NULL DEFAULT false,
    "driverScoringWeights" JSONB,
    "dataRetentionPolicy" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "totpSecretEncrypted" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyType" "ConsentPolicyType" NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "toneStyle" "ToneStyle" NOT NULL DEFAULT 'WARM_FRIENDLY',
    "customToneDescription" TEXT,
    "escalationRules" JSONB,
    "homeAddressEncrypted" TEXT,
    "distressPhraseEncrypted" TEXT,
    "trustedContactName" TEXT,
    "trustedContactPhone" TEXT,
    "commissionRate" DOUBLE PRECISION DEFAULT 0.7,
    "flatRatePerServiceCents" INTEGER,
    "minimumNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "maximumAdvanceDays" INTEGER NOT NULL DEFAULT 60,
    "maxJobsPerDay" INTEGER NOT NULL DEFAULT 6,
    "maxWorkingHoursPerDay" INTEGER NOT NULL DEFAULT 10,
    "defaultSetupMinutes" INTEGER NOT NULL DEFAULT 15,
    "defaultPackDownMinutes" INTEGER NOT NULL DEFAULT 15,
    "minTravelBufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "maxTravelDistanceKm" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "approvedSuburbs" TEXT[],
    "autoApproveBookings" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseDurationMinutes" INTEGER NOT NULL,
    "basePriceCents" INTEGER NOT NULL,
    "requiresDriverDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerService" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "priceCentsOverride" INTEGER,
    "durationMinutesOverride" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WorkerService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerAvailability" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "breakStartMinute" INTEGER,
    "breakEndMinute" INTEGER,

    CONSTRAINT "WorkerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedTime" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "type" "BlockedTimeType" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarConnection" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "expiresAt" TIMESTAMP(3),
    "calendarId" TEXT,
    "syncCursor" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "vehicleDescription" TEXT,
    "serviceAreas" TEXT[],
    "maxConcurrentJobs" INTEGER NOT NULL DEFAULT 1,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "canRemainNearby" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverAvailability" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "DriverAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerDriverPreference" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "preference" "DriverPreference" NOT NULL,

    CONSTRAINT "WorkerDriverPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "verifiedContact" BOOLEAN NOT NULL DEFAULT false,
    "safetyStatus" "ClientSafetyStatus" NOT NULL DEFAULT 'STANDARD',
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAddress" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "suburb" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'AU',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "firstUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "addressId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'NEW_ENQUIRY',
    "requestedStart" TIMESTAMP(3),
    "confirmedStart" TIMESTAMP(3),
    "confirmedEnd" TIMESTAMP(3),
    "travelMinutes" INTEGER,
    "setupMinutes" INTEGER,
    "packDownMinutes" INTEGER,
    "requiresDriver" BOOLEAN NOT NULL DEFAULT false,
    "workerSurveyDone" BOOLEAN NOT NULL DEFAULT false,
    "clientSurveyDone" BOOLEAN NOT NULL DEFAULT false,
    "depositRequiredCents" INTEGER NOT NULL DEFAULT 0,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingStatusHistory" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus" NOT NULL,
    "changedByUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "workerId" TEXT,
    "bookingId" TEXT,
    "needsHuman" BOOLEAN NOT NULL DEFAULT false,
    "escalationReason" TEXT,
    "takenOverByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "senderUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerSafetySurvey" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "q1SafeAndComfortable" "WorkerSafetyQ1" NOT NULL,
    "q2RespectedBoundaries" "WorkerSafetyQ2" NOT NULL,
    "q3BookingAccurate" "WorkerSafetyQ3" NOT NULL,
    "q4IssueSeverity" "WorkerSafetyQ4" NOT NULL,
    "q5FutureBookings" "WorkerSafetyQ5" NOT NULL,
    "additionalConditions" "RestrictionType"[],
    "customConditionText" TEXT,
    "privateNotesEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerSafetySurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSatisfactionSurvey" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "q1Satisfaction" "ClientSatisfactionQ1" NOT NULL,
    "q2Punctuality" "ClientSatisfactionQ2" NOT NULL,
    "q3Professionalism" "ClientSatisfactionQ3" NOT NULL,
    "q4MatchedExpectations" "ClientSatisfactionQ4" NOT NULL,
    "q5WouldReturn" "ClientSatisfactionQ5" NOT NULL,
    "comments" TEXT,
    "contactMeBack" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientSatisfactionSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyIncident" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientId" TEXT,
    "workerId" TEXT,
    "bookingId" TEXT,
    "source" "IncidentSource" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "reportedByUserId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRestriction" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "RestrictionType" NOT NULL,
    "customText" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ClientRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSafetyStatusHistory" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fromStatus" "ClientSafetyStatus",
    "toStatus" "ClientSafetyStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientSafetyStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCorrectionRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "CorrectionRequestStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNotes" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverJob" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "driverId" TEXT,
    "legType" "DriverJobLegType" NOT NULL DEFAULT 'OUTBOUND',
    "pickupAddress" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "estimatedTravelMinutes" INTEGER NOT NULL,
    "estimatedWaitingMinutes" INTEGER,
    "returnTripRequired" BOOLEAN NOT NULL DEFAULT false,
    "driverPaymentCents" INTEGER NOT NULL DEFAULT 0,
    "specialInstructions" TEXT,
    "safetyRequirements" "RestrictionType"[],
    "status" "DriverJobStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "offeredAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverStatusHistory" (
    "id" TEXT NOT NULL,
    "driverJobId" TEXT NOT NULL,
    "fromStatus" "DriverJobStatus",
    "toStatus" "DriverJobStatus" NOT NULL,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "providerReferenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bookingId" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverPayment" (
    "id" TEXT NOT NULL,
    "driverJobId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_businessId_idx" ON "User"("businessId");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_userId_key" ON "Worker"("userId");

-- CreateIndex
CREATE INDEX "Worker_businessId_idx" ON "Worker"("businessId");

-- CreateIndex
CREATE INDEX "Service_businessId_idx" ON "Service"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerService_workerId_serviceId_key" ON "WorkerService"("workerId", "serviceId");

-- CreateIndex
CREATE INDEX "WorkerAvailability_workerId_dayOfWeek_idx" ON "WorkerAvailability"("workerId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "BlockedTime_workerId_startAt_endAt_idx" ON "BlockedTime"("workerId", "startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_workerId_provider_key" ON "CalendarConnection"("workerId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- CreateIndex
CREATE INDEX "Driver_businessId_idx" ON "Driver"("businessId");

-- CreateIndex
CREATE INDEX "DriverAvailability_driverId_dayOfWeek_idx" ON "DriverAvailability"("driverId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerDriverPreference_workerId_driverId_key" ON "WorkerDriverPreference"("workerId", "driverId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_userId_key" ON "Client"("userId");

-- CreateIndex
CREATE INDEX "Client_businessId_idx" ON "Client"("businessId");

-- CreateIndex
CREATE INDEX "Client_phone_idx" ON "Client"("phone");

-- CreateIndex
CREATE INDEX "ClientAddress_clientId_idx" ON "ClientAddress"("clientId");

-- CreateIndex
CREATE INDEX "Booking_workerId_confirmedStart_idx" ON "Booking"("workerId", "confirmedStart");

-- CreateIndex
CREATE INDEX "Booking_businessId_status_idx" ON "Booking"("businessId", "status");

-- CreateIndex
CREATE INDEX "Booking_clientId_idx" ON "Booking"("clientId");

-- CreateIndex
CREATE INDEX "BookingStatusHistory_bookingId_createdAt_idx" ON "BookingStatusHistory"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_businessId_idx" ON "Conversation"("businessId");

-- CreateIndex
CREATE INDEX "Conversation_clientId_idx" ON "Conversation"("clientId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerSafetySurvey_bookingId_key" ON "WorkerSafetySurvey"("bookingId");

-- CreateIndex
CREATE INDEX "WorkerSafetySurvey_workerId_idx" ON "WorkerSafetySurvey"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientSatisfactionSurvey_bookingId_key" ON "ClientSatisfactionSurvey"("bookingId");

-- CreateIndex
CREATE INDEX "ClientSatisfactionSurvey_clientId_idx" ON "ClientSatisfactionSurvey"("clientId");

-- CreateIndex
CREATE INDEX "SafetyIncident_businessId_resolved_idx" ON "SafetyIncident"("businessId", "resolved");

-- CreateIndex
CREATE INDEX "SafetyIncident_clientId_idx" ON "SafetyIncident"("clientId");

-- CreateIndex
CREATE INDEX "ClientRestriction_clientId_active_idx" ON "ClientRestriction"("clientId", "active");

-- CreateIndex
CREATE INDEX "ClientSafetyStatusHistory_clientId_createdAt_idx" ON "ClientSafetyStatusHistory"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "DataCorrectionRequest_clientId_idx" ON "DataCorrectionRequest"("clientId");

-- CreateIndex
CREATE INDEX "DriverJob_driverId_status_idx" ON "DriverJob"("driverId", "status");

-- CreateIndex
CREATE INDEX "DriverJob_bookingId_idx" ON "DriverJob"("bookingId");

-- CreateIndex
CREATE INDEX "DriverStatusHistory_driverJobId_createdAt_idx" ON "DriverStatusHistory"("driverJobId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_businessId_status_idx" ON "Payment"("businessId", "status");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE INDEX "Expense_businessId_category_idx" ON "Expense"("businessId", "category");

-- CreateIndex
CREATE INDEX "Expense_bookingId_idx" ON "Expense"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverPayment_driverJobId_key" ON "DriverPayment"("driverJobId");

-- CreateIndex
CREATE INDEX "DriverPayment_driverId_idx" ON "DriverPayment"("driverId");

-- CreateIndex
CREATE INDEX "Notification_userId_status_idx" ON "Notification"("userId", "status");

-- CreateIndex
CREATE INDEX "Notification_businessId_createdAt_idx" ON "Notification"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_createdAt_idx" ON "AuditLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerService" ADD CONSTRAINT "WorkerService_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerService" ADD CONSTRAINT "WorkerService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerAvailability" ADD CONSTRAINT "WorkerAvailability_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedTime" ADD CONSTRAINT "BlockedTime_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverAvailability" ADD CONSTRAINT "DriverAvailability_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerDriverPreference" ADD CONSTRAINT "WorkerDriverPreference_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerDriverPreference" ADD CONSTRAINT "WorkerDriverPreference_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAddress" ADD CONSTRAINT "ClientAddress_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "ClientAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerSafetySurvey" ADD CONSTRAINT "WorkerSafetySurvey_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerSafetySurvey" ADD CONSTRAINT "WorkerSafetySurvey_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSatisfactionSurvey" ADD CONSTRAINT "ClientSatisfactionSurvey_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSatisfactionSurvey" ADD CONSTRAINT "ClientSatisfactionSurvey_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRestriction" ADD CONSTRAINT "ClientRestriction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSafetyStatusHistory" ADD CONSTRAINT "ClientSafetyStatusHistory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataCorrectionRequest" ADD CONSTRAINT "DataCorrectionRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverJob" ADD CONSTRAINT "DriverJob_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverJob" ADD CONSTRAINT "DriverJob_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverJob" ADD CONSTRAINT "DriverJob_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverJob" ADD CONSTRAINT "DriverJob_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverStatusHistory" ADD CONSTRAINT "DriverStatusHistory_driverJobId_fkey" FOREIGN KEY ("driverJobId") REFERENCES "DriverJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPayment" ADD CONSTRAINT "DriverPayment_driverJobId_fkey" FOREIGN KEY ("driverJobId") REFERENCES "DriverJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPayment" ADD CONSTRAINT "DriverPayment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
