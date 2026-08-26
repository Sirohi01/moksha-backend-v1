import "dotenv/config";
import dns from "dns";

// This machine's default DNS resolver cannot resolve mongodb+srv:// SRV records for at least one
// of the source Atlas clusters (confirmed: works with explicit public resolvers, fails with the
// OS default) — every migration script needs this before calling mongoose.connect() against a
// MIGRATION_*_MONGO_URI. Does not affect the app's own MONGODB_URI, which already connects fine
// via explicit shard hostnames rather than the +srv shorthand.
dns.setServers(["8.8.8.8", "1.1.1.1"]);
