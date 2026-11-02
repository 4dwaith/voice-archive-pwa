"""Rebuild the small geometry fixture and synthetic range-loading fixture.

Run with the backend's Python environment (pypdf). Both fixtures are checked in
for frontend-only test runs; neither is shipped with the application.
"""

from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject, RectangleObject


def write_reader_pdf(path: Path, padding_size: int = 0) -> None:
    writer = PdfWriter()
    for index, (width, height) in enumerate([(240, 360), (360, 240), (300, 420)]):
        page = writer.add_blank_page(width, height)
        if index == 1:
            page.cropbox = RectangleObject([20, 10, 340, 230])
            page.rotate(90)
            drawing = b"0.8 0.8 0.8 rg 68 32 48 110 re f\n"
        else:
            drawing = f"0.8 0.8 0.8 rg {width * .2} {height * .65} {width * .6} {height * .1} re f\n".encode()
        stream = DecodedStreamObject()
        stream.set_data(drawing + b"% fixture padding\n" * (padding_size // 18))
        page[NameObject('/Contents')] = writer._add_object(stream)
    writer.set_page_label(0, 0, prefix="Cover")
    writer.set_page_label(1, 2, style="/D", start=1)
    writer.write(path)


if __name__ == '__main__':
    directory = Path(__file__).resolve().parents[1] / 'cypress' / 'fixtures'
    write_reader_pdf(directory / 'reader.pdf')
    write_reader_pdf(directory / 'reader-range.pdf', padding_size=512_000)
