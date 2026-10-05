const { OAuth2Client } = require("google-auth-library");

let testVerifier = null;

/**
 * Set an in-memory token verifier for testing purposes.
 * Enables zero-network, deterministic security testing.
 */
function setTestVerifier(verifier) {
  testVerifier = verifier;
}

function resetTestVerifier() {
  testVerifier = null;
}

/**
 * Verifies a Google ID Token cryptographically.
 *
 * @param {string} idToken - The JWT credential received from client.
 * @param {string} [configuredClientId] - Client ID from environment.
 * @returns {Promise<{ email: string, name: string, picture: string|null, sub: string }>}
 */
async function verifyGoogleIdToken(idToken, configuredClientId) {
  if (!configuredClientId) {
    const error = new Error("Autenticación con Google no configurada en el servidor");
    error.code = "AUTH_NOT_CONFIGURED";
    error.status = 503;
    throw error;
  }

  if (!idToken || typeof idToken !== "string" || idToken.trim().length === 0) {
    const error = new Error("Token de Google faltante o inválido");
    error.code = "INVALID_TOKEN";
    error.status = 400;
    throw error;
  }

  // Use test verifier if registered in test environment
  if (testVerifier) {
    return await testVerifier(idToken, configuredClientId);
  }

  try {
    const client = new OAuth2Client(configuredClientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: configuredClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      const error = new Error("Payload del token no disponible");
      error.code = "INVALID_TOKEN";
      error.status = 401;
      throw error;
    }

    const validIssuers = ["accounts.google.com", "https://accounts.google.com"];
    if (!validIssuers.includes(payload.iss)) {
      const error = new Error("Emisor (iss) del token Google no confiable");
      error.code = "INVALID_ISSUER";
      error.status = 401;
      throw error;
    }

    if (payload.aud !== configuredClientId) {
      const error = new Error("Audience (aud) del token Google no coincide con el servidor");
      error.code = "INVALID_AUDIENCE";
      error.status = 401;
      throw error;
    }

    if (!payload.email_verified) {
      const error = new Error("La cuenta Google no tiene el email verificado");
      error.code = "EMAIL_NOT_VERIFIED";
      error.status = 401;
      throw error;
    }

    if (!payload.email || typeof payload.email !== "string") {
      const error = new Error("El token Google no contiene un email válido");
      error.code = "INVALID_EMAIL";
      error.status = 401;
      throw error;
    }

    return {
      email: payload.email,
      name: payload.name || payload.given_name || payload.email.split("@")[0],
      picture: payload.picture || null,
      sub: payload.sub,
    };
  } catch (err) {
    if (err.status) throw err;
    const error = new Error("Verificación criptográfica del token Google falló");
    error.code = "TOKEN_VERIFICATION_FAILED";
    error.status = 401;
    throw error;
  }
}

module.exports = {
  verifyGoogleIdToken,
  setTestVerifier,
  resetTestVerifier,
};
