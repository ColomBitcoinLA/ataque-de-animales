/**
 * Builds CORS configuration options.
 *
 * In production:
 * - Reads ALLOWED_ORIGINS (comma-separated list).
 * - Rejects any unlisted cross-origin requests.
 * - Allows same-origin (no Origin header).
 *
 * In development / test:
 * - Allows requests from localhost / 127.0.0.1 on any port.
 * - Allows requests without Origin header (curl, mobile, test scripts).
 */
function createCorsOptions() {
  const isProd = process.env.NODE_ENV === "production";
  const rawAllowed = process.env.ALLOWED_ORIGINS || "";
  const allowedList = rawAllowed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    origin(origin, callback) {
      // Requests without origin header (same-origin, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      if (isProd) {
        if (allowedList.length > 0 && allowedList.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("CORS policy does not allow this origin"));
      }

      // Dev / Test mode: allow localhost and 127.0.0.1 origins
      try {
        const parsed = new URL(origin);
        if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
          return callback(null, true);
        }
      } catch {
        // invalid URL
      }

      if (allowedList.length > 0 && allowedList.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS policy does not allow this origin in development"));
    },
    credentials: true,
  };
}

module.exports = {
  createCorsOptions,
};
