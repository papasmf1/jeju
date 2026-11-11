#워드파일생성.py

from pathlib import Path

import win32com.client
from pptx import Presentation
from pptx.util import Inches, Pt

output_path = Path.cwd() / "sample.doc"
word = win32com.client.DispatchEx("Word.Application")
document = None

try:
    word.Visible = False
    document = word.Documents.Add()
    document.Content.Text = "아래의 내용을 워드 파일에 추가해줘"

    # 0: Word 97–2003 문서 형식(.doc)
    document.SaveAs2(str(output_path), FileFormat=0)
    print(f"저장 완료: {output_path}")
finally:
    try:
        if document is not None:
            document.Close(SaveChanges=False)
    finally:
        word.Quit()

# 새 프레젠테이션과 빈 슬라이드 생성
presentation = Presentation()
slide = presentation.slides.add_slide(presentation.slide_layouts[6])

# 텍스트 상자 추가
textbox = slide.shapes.add_textbox(
    Inches(1), Inches(1), Inches(8), Inches(1)
)
paragraph = textbox.text_frame.paragraphs[0]
paragraph.text = "이런 내용을 추가"
paragraph.font.size = Pt(32)

# 현재 작업 폴더에 저장
presentation.save("sample.pptx")



