#!/bin/bash

# Get the latest commit info
COMMIT_SHA=$(git rev-parse --short HEAD)
TIMESTAMP=$(git show -s --format=%cI HEAD)

# Create the version file
cat > backend/version.gs << EOF
// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Generated automatically by update-version.sh
var BUILD_META = {
  commit: '${COMMIT_SHA}',
  timestamp: '${TIMESTAMP}'
};
function api_getBuildMeta() {
  return BUILD_META;
}
EOF

echo "Updated backend/version.gs with commit ${COMMIT_SHA}"