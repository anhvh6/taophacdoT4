import fitz  # PyMuPDF

def read_pdf(file_path):
    print(f"\n--- Reading {file_path} ---")
    try:
        doc = fitz.open(file_path)
        text = ""
        for page in doc:
            text += page.get_text()
        print(text[:1000])  # Print first 1000 chars
    except Exception as e:
        print(f"Error: {e}")

files = [
    'd:/Lap trinh/Taophacdo/Bao cao/bao cao 2.pdf',
    'd:/Lap trinh/Taophacdo/Bao cao/bao cao 3.pdf',
    'd:/Lap trinh/Taophacdo/Bao cao/bao cao.pdf'
]

for f in files:
    read_pdf(f)
