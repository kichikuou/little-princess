#!/bin/bash

if [ -n "$(git status --porcelain)" ]; then
    echo "Error: Working tree is not clean. Please commit or stash your changes."
    exit 1
fi

if [ ! -d "cg" ]; then
    echo "cg/ directory not found. Running setup.py..."
    python3 setup.py
fi

# The name of the output zip file
OUTPUT_ZIP="little-princess.zip"

# The root directory inside the zip file
ROOT_DIR="little-princess"

# Create a temporary directory to structure the package
TEMP_DIR=$(mktemp -d)

# The directory to be zipped
PACKAGE_SOURCE="$TEMP_DIR/$ROOT_DIR"

# Create the root directory
mkdir -p "$PACKAGE_SOURCE"

# Copy all files to the temporary directory, excluding specified files
echo "Copying files to temporary directory..."
for item in *; do
    case "$item" in
        "setup.py"|"package.sh"|"$OUTPUT_ZIP"|"$TEMP_DIR")
            # Skip these files/directories
            ;;
        *)
            # Copy everything else
            cp -r "$item" "$PACKAGE_SOURCE/"
            ;;
    esac
done

# Go to the temporary directory to create the zip file
cd "$TEMP_DIR"

# Create the zip file
zip -r "$OLDPWD/$OUTPUT_ZIP" "$ROOT_DIR"

# Go back to the original directory
cd "$OLDPWD"

# Clean up the temporary directory
rm -rf "$TEMP_DIR"

echo "Package created: $OUTPUT_ZIP"
