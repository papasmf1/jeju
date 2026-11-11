from pathlib import Path
from random import choice, randint

from openpyxl import Workbook


def main():
    products = (
        "스마트폰",
        "노트북",
        "태블릿",
        "모니터",
        "키보드",
        "마우스",
        "이어폰",
        "스피커",
        "스마트워치",
        "프린터",
    )
    output_path = Path(__file__).resolve().with_name("products.xlsx")

    workbook = Workbook(write_only=True)
    sheet = workbook.create_sheet("제품")
    sheet.append(["제품ID", "제품명", "수량", "가격"])

    for product_id in range(1, 100_001):
        sheet.append([
            f"P{product_id:06d}",
            choice(products),
            randint(0, 100),
            randint(10, 2000) * 1000,
        ])

    workbook.save(output_path)
    print(f"제품 100,000개를 저장했습니다: {output_path}")


if __name__ == "__main__":
    main()
