// Runs before any test module is loaded. Points the Prisma singleton at the isolated test
// database and provides the crypto secrets needed by lib/crypto and lib/auth, so integration
// tests never touch the seeded development database.
process.env.DATABASE_URL ||= "postgresql://postgres:postgres@localhost:5432/truereach_test?schema=public";
process.env.FIELD_ENCRYPTION_KEY ||= "0".repeat(64);
process.env.AUTH_SECRET ||= "test-secret-test-secret-test-secret";
process.env.INTEGRATION_MODE ||= "dev";
