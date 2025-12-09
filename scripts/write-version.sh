#!/bin/bash

BUILD_DATE=$(date -u +%Y-%m-%d)

# Create the version file
cat > backend/version.gs << EOF
// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Generated automatically by scripts/write-version.sh
var BUILD_META = {
  buildDate: '${BUILD_DATE}'
};
function api_getBuildMeta() {
  return BUILD_META;
}
EOF

echo "Updated backend/version.gs with build date ${BUILD_DATE}"
