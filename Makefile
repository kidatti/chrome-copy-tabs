# CopyTabs Chrome Extension Build Script

# Get version from the single source of truth
VERSION := $(shell cat .version)
PACKAGE_NAME := copytabs-v$(VERSION)
DIST_DIR := dist
SRC_DIR := src

# Default target
.PHONY: all
all: build

# Create distribution package
.PHONY: build
build:
	node scripts/build.cjs build "$(DIST_DIR)"

# Clean build artifacts
.PHONY: clean
clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf $(DIST_DIR)
	@echo "✅ Clean completed"

# Show current version
.PHONY: version
version: sync-version
	@echo "Current version: $(VERSION)"

.PHONY: sync-version
sync-version:
	@node scripts/version.cjs sync

# Prepare for release (build + show info)
.PHONY: release
release: build
	@echo ""
	@echo "📦 Release Package Information:"
	@echo "   Package: $(PACKAGE_NAME).zip"
	@echo "   Version: $(VERSION)"
	@echo "   Location: $(DIST_DIR)/$(PACKAGE_NAME).zip"
	@echo "   Ready for Chrome Web Store upload!"

# Development build (copy files without zip)
.PHONY: dev
dev:
	node scripts/build.cjs dev "$(DIST_DIR)"

# Validate manifest and files
.PHONY: validate
validate: sync-version
	@echo "🔍 Validating extension..."
	@if [ ! -f "$(SRC_DIR)/manifest.json" ]; then \
		echo "❌ manifest.json not found"; exit 1; \
	fi
	@if ! grep -q '"manifest_version": 3' $(SRC_DIR)/manifest.json; then \
		echo "❌ Not a Manifest V3 extension"; exit 1; \
	fi
	@echo "✅ Validation passed"

# List files that will be included in package
.PHONY: test
test:
	node --test tests/*.test.js

.PHONY: test-popup
test-popup:
	node tests/popup-sizing.cjs

.PHONY: list-files
list-files:
	@echo "📄 Files to be included in package:"
	@cd $(SRC_DIR) && find . -type f ! -name "*.DS_Store" ! -name "Thumbs.db" ! -name "*.tmp" ! -name "*.log" | sort

# Help
.PHONY: help
help:
	@echo "CopyTabs Build System"
	@echo ""
	@echo "Available targets:"
	@echo "  build        - Create release package (zip file)"
	@echo "  dev          - Create development build (unzipped)"
	@echo "  release      - Build and show release information"
	@echo "  clean        - Remove build artifacts"
	@echo "  validate     - Validate extension files"
	@echo "  test         - Run manager and version regression tests"
	@echo "  test-popup   - Run popup sizing regression (requires Playwright)"
	@echo "  sync-version - Reflect .version in manifest.json"
	@echo "  version      - Show current version"
	@echo "  list-files   - List files to be included"
	@echo "  help         - Show this help"
	@echo ""
	@echo "Current version: $(VERSION)"
