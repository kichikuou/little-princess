
import os
import requests
import zipfile
import io

# URL of the zip file
url = "http://takeda-toshiya.my.coocan.jp/alice/lp32.zip"

# Target directory for the cg files
cg_dir = "cg"

# Create the cg directory if it doesn't exist
os.makedirs(cg_dir, exist_ok=True)

print(f"Downloading {url}...")
try:
    response = requests.get(url)
    response.raise_for_status()  # Raise an exception for bad status codes

    print("Extracting files...")
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        for member in z.infolist():
            # Check if the file is in the lp32/cg/ directory and is a .gif file
            if member.filename.lower().startswith("lp32/cg/") and member.filename.lower().endswith(".gif"):
                # Extract the file to the cg directory with a lowercase filename
                filename = os.path.basename(member.filename).lower()
                with open(os.path.join(cg_dir, filename), "wb") as f:
                    f.write(z.read(member))
                print(f"  - Extracted: {filename}")

    print("Setup complete.")

except requests.exceptions.RequestException as e:
    print(f"Error downloading the file: {e}")
except zipfile.BadZipFile:
    print("Error: The downloaded file is not a valid zip file.")
except Exception as e:
    print(f"An unexpected error occurred: {e}")

