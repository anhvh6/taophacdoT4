import fitz  # PyMuPDF

def read_pdf(file_path):
    print(f"\n--- Reading {file_path} ---")
    try:
        doc = fitz.open(file_path)
        print(f"Pages: {doc.page_count}")
        for i in range(doc.page_count):
            page = doc[i]
            text = page.get_text()
            if text.strip():
                print(f"Page {i+1} text length: {len(text)}")
                print(text[:200])
            else:
                print(f"Page {i+1} has no text. Trying to find images...")
                images = page.get_images()
                print(f"Found {len(images)} images.")
    except Exception as e:
        print(f"Error: {e}")

files = [
    'd:/Lap trinh/Taophacdo/Bao cao/bao cao 2.pdf',
    'd:/Lap trinh/Taophacdo/Bao cao/bao cao 3.pdf',
    'd:/Lap trinh/Taophacdo/Bao cao/bao cao.pdf'
]

for f in files:
    read_pdf(f)
