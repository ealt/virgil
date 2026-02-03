#!/bin/bash
set -e

# Define paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CONVERSION_SCRIPT="$SCRIPT_DIR/md-to-walkthrough.js"
GOLDENS_DIR="$REPO_ROOT/tests/goldens"
TEMP_DIR=$(mktemp -d)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Cleanup on exit
trap "rm -rf $TEMP_DIR" EXIT

echo "Running conversion tests..."

# Check dependencies
if [ ! -f "$REPO_ROOT/out/markdownParser.js" ]; then
    echo -e "${RED}Error: out/markdownParser.js not found. Run 'npm run compile' first.${NC}"
    exit 1
fi

# Function to test a file
test_conversion() {
    local input_file=$1
    local golden_file=$2
    local name=$(basename "$input_file")
    local output_file="$TEMP_DIR/$name.json"

    echo -n "Testing $name... "

    # Run conversion
    node "$CONVERSION_SCRIPT" "$input_file" "$output_file"
    
    # Compare with golden
    if diff "$output_file" "$golden_file" > /dev/null; then
        echo -e "${GREEN}PASS${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        echo "Differences found:"
        diff "$output_file" "$golden_file"
        return 1
    fi
}

# Run tests
FAILED=0

# Test Developer Guide
test_conversion "$REPO_ROOT/docs/developer-guide.md" "$GOLDENS_DIR/developer-guide.json" || FAILED=1

# Test Diff Walkthrough
test_conversion "$REPO_ROOT/docs/diff-walkthrough.md" "$GOLDENS_DIR/diff-walkthrough.json" || FAILED=1

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All conversion tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed.${NC}"
    exit 1
fi
