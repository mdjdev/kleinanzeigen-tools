#!/usr/bin/env bash
set -euo pipefail

# check-release.sh
# Validates version consistency across script, README, and CHANGELOG.
# Run before tagging to catch mismatches early.
# Usage: ./scripts/check-release.sh [EXPECTED_VERSION]

SCRIPT_FILE="kleinanzeigen-tools.user.js"
README_FILE="README.md"
CHANGELOG_FILE="CHANGELOG.md"

# Extract version from script metadata
SCRIPT_VERSION=$(grep -oP '@version\s+\K[0-9]+\.[0-9]+\.[0-9]+' "$SCRIPT_FILE")

# Extract version from README badge
README_VERSION=$(grep -oP 'version-\K[0-9]+\.[0-9]+\.[0-9]+' "$README_FILE")

# Extract version from latest CHANGELOG heading
CHANGELOG_VERSION=$(grep -oP '^## \[\K[0-9]+\.[0-9]+\.[0-9]+' "$CHANGELOG_FILE" | head -n1)

ERRORS=0

check_match() {
    local name="$1"
    local found="$2"
    local expected="$3"
    if [ "$found" != "$expected" ]; then
        echo "Error: $name version ($found) does not match expected ($expected)"
        ERRORS=$((ERRORS + 1))
    fi
}

echo "Found versions:"
echo "  Script:    $SCRIPT_VERSION"
echo "  README:    $README_VERSION"
echo "  CHANGELOG: $CHANGELOG_VERSION"
echo ""

# If no argument provided, use script version as the canonical source
EXPECTED="${1:-$SCRIPT_VERSION}"

check_match "Script"    "$SCRIPT_VERSION"  "$EXPECTED"
check_match "README"    "$README_VERSION"  "$EXPECTED"
check_match "CHANGELOG" "$CHANGELOG_VERSION" "$EXPECTED"

# Simulate the GitHub Action changelog extraction (same awk as release.yml)
# so the release body will be populated when the tag is pushed.
RELEASE_BODY=$(awk "/^## \[$EXPECTED\]/{found=1;next} found && /^## \[/{exit} found{print}" "$CHANGELOG_FILE")
if [ -z "$RELEASE_BODY" ]; then
    echo "Error: GitHub Action cannot extract changelog section for version [$EXPECTED]"
    ERRORS=$((ERRORS + 1))
else
    echo "Release body extraction for $EXPECTED: OK"
fi

if [ "$ERRORS" -gt 0 ]; then
    echo ""
    echo "$ERRORS check(s) failed. Fix the mismatches before tagging."
    exit 1
fi

echo "All version checks passed for $EXPECTED."
