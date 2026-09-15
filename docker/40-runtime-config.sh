#!/bin/sh
# Writes /runtime-config from ADMIN_USERNAME / ADMIN_PASSWORD at container start.
# Only the salted hash is written; the plaintext password never reaches the browser.
set -eu

: "${ADMIN_USERNAME:=admin}"

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "runtime-config: ADMIN_PASSWORD is not set" >&2
  exit 1
fi
if [ "${#ADMIN_PASSWORD}" -lt 6 ]; then
  echo "runtime-config: ADMIN_PASSWORD must be at least 6 characters" >&2
  exit 1
fi
if ! printf '%s' "$ADMIN_USERNAME" | grep -Eq '^[A-Za-z0-9._-]{3,}$'; then
  echo "runtime-config: ADMIN_USERNAME must be 3+ characters of letters, digits, . _ -" >&2
  exit 1
fi

# Must match hashPassword() in lib/auth/storage.ts.
hash="$(printf '%s%s' "$ADMIN_PASSWORD" "_tero_salt_2026" | sha256sum | cut -d ' ' -f 1)"
username="$(printf '%s' "$ADMIN_USERNAME" | tr 'A-Z' 'a-z')"

cat > /usr/share/nginx/html/runtime-config <<EOF
window.__TERO_AUTH_CONFIG__ = { adminUsername: "${username}", adminPasswordHash: "${hash}" };
EOF

echo "runtime-config: default admin \"${username}\" configured"
