# CopyTabs Chrome Extension Build Script

# Get version from manifest.json
VERSION := $(shell grep '"version"' src/manifest.json | sed 's/.*"version": "\([^"]*\)".*/\1/')
PACKAGE_NAME := copytabs-v$(VERSION)
DIST_DIR := dist
SRC_DIR := src

# Default target
.PHONY: all
all: build

# Create distribution package
.PHONY: build
build: clean
	@echo "Building CopyTabs v$(VERSION)..."
	@mkdir -p $(DIST_DIR)
	@echo "Creating package: $(PACKAGE_NAME).zip"
	@cd $(SRC_DIR) && zip -r ../$(DIST_DIR)/$(PACKAGE_NAME).zip . \
		-x "*.DS_Store" "Thumbs.db" "*.tmp" "*.log"
	@echo "✅ Package created: $(DIST_DIR)/$(PACKAGE_NAME).zip"
	@echo "📁 Package size: $$(du -h $(DIST_DIR)/$(PACKAGE_NAME).zip | cut -f1)"

# Clean build artifacts
.PHONY: clean
clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf $(DIST_DIR)
	@echo "✅ Clean completed"

# Show current version
.PHONY: version
version:
	@echo "Current version: $(VERSION)"

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
dev: clean
	@echo "🔨 Creating development build..."
	@mkdir -p $(DIST_DIR)/$(PACKAGE_NAME)
	@cp -r $(SRC_DIR)/* $(DIST_DIR)/$(PACKAGE_NAME)/
	@echo "✅ Development build created: $(DIST_DIR)/$(PACKAGE_NAME)/"
	@echo "   Load unpacked extension from this directory in Chrome"

# Validate manifest and files
.PHONY: validate
validate:
	@echo "🔍 Validating extension..."
	@if [ ! -f "$(SRC_DIR)/manifest.json" ]; then \
		echo "❌ manifest.json not found"; exit 1; \
	fi
	@if ! grep -q '"manifest_version": 3' $(SRC_DIR)/manifest.json; then \
		echo "❌ Not a Manifest V3 extension"; exit 1; \
	fi
	@echo "✅ Validation passed"

# List files that will be included in package
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
	@echo "  version      - Show current version"
	@echo "  list-files   - List files to be included"
	@echo "  help         - Show this help"
	@echo ""
	@echo "Current version: $(VERSION)"